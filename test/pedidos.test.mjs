// Tests del modulo /api/pedidos (src/controllers/pedidos.controller.js +
// src/routes/pedidos.routes.js), montado en src/app.js.
//
// Usa el runner nativo de Node (`node --test`, node >=18) y supertest para
// golpear el `http.Server` de app.js sin bindear un puerto fijo (supertest
// lo levanta el mismo en un puerto efimero). app.js solo llama a .listen()
// cuando se ejecuta directo (ver el guard alli), asi que importarlo aca no
// ocupa ningun puerto real.
//
// Los pedidos y los repartidores son datos en memoria compartidos por todo
// el archivo (un solo proceso, un solo `app`), asi que los subtests corren
// en orden (via `t.test` awaited) y algunos dependen del estado que dejo el
// anterior -- esta documentado en cada uno.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

const BASE = '/api/pedidos';

after(() => {
  app.close();
});

test('modulo de pedidos', async (t) => {
  // ids de pedidos creados durante el archivo, para reusarlos entre subtests
  let idAsignacionFeliz;
  let idRepartidorOcupado;
  let idRepartidorInexistente;
  let idCancelarSinMotivo;

  await t.test('POST /api/pedidos crea un pedido pendiente con el recargo de zona aplicado', async () => {
    const res = await request(app).post(BASE).send({
      cliente: 'Cliente Alta',
      telefono: '11-0000-0001',
      direccion: 'Calle Alta 100',
      zona: 'Norte', // 10% de recargo, ver src/data/zonas.js
      importe: 1000,
      items: '1x Item de prueba',
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.estado, 'pendiente');
    assert.equal(res.body.importeBase, 1000);
    assert.equal(res.body.importe, 1100);
    assert.equal(res.body.repartidorId, null);
    assert.equal(res.body.repartidor, null);
    assert.ok(res.body.id);
  });

  await t.test('POST /api/pedidos sin datos obligatorios devuelve 400', async () => {
    const res = await request(app).post(BASE).send({ cliente: 'Sin direccion ni zona' });
    assert.equal(res.status, 400);
    assert.match(res.body.mensaje, /Faltan datos/);
  });

  await t.test('GET /api/pedidos lista todo y filtra por estado', async () => {
    const todos = await request(app).get(BASE);
    assert.equal(todos.status, 200);
    assert.ok(Array.isArray(todos.body));
    assert.ok(todos.body.length >= 16); // 15 de la semilla + el creado arriba

    const pendientes = await request(app).get(`${BASE}?estado=pendiente`);
    assert.equal(pendientes.status, 200);
    assert.ok(pendientes.body.length > 0);
    assert.ok(pendientes.body.every((p) => p.estado === 'pendiente'));
  });

  await t.test('asignar: camino feliz pasa a "asignado" y ocupa al repartidor', async () => {
    const alta = await request(app).post(BASE).send({
      cliente: 'Cliente Asignacion',
      direccion: 'Calle Asignacion 1',
      zona: 'Centro',
      importe: 500,
    });
    idAsignacionFeliz = alta.body.id;

    // repartidor '2' (Carlos Ruiz) esta libre en la semilla de src/db.js
    const res = await request(app)
      .post(`${BASE}/${idAsignacionFeliz}/asignar`)
      .send({ repartidorId: '2' });

    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'asignado');
    assert.equal(res.body.repartidorId, '2');
    assert.equal(res.body.repartidor, 'Carlos Ruiz');
    assert.ok(res.body.horaAsignacion);
  });

  await t.test('asignar: repartidor ocupado devuelve 409', async () => {
    const alta = await request(app).post(BASE).send({
      cliente: 'Cliente Repartidor Ocupado',
      direccion: 'Calle Ocupado 1',
      zona: 'Centro',
      importe: 500,
    });
    idRepartidorOcupado = alta.body.id;

    // repartidor '1' (Ana Gomez) arranca no libre en la semilla de src/db.js
    const res = await request(app)
      .post(`${BASE}/${idRepartidorOcupado}/asignar`)
      .send({ repartidorId: '1' });

    assert.equal(res.status, 409);
    assert.match(res.body.mensaje, /ya no esta libre/);

    // el pedido se queda pendiente: la asignacion no se aplico
    const listado = await request(app).get(`${BASE}?estado=pendiente`);
    assert.ok(listado.body.some((p) => p.id === idRepartidorOcupado));
  });

  await t.test('asignar: pedido que no esta pendiente devuelve 409', async () => {
    // idAsignacionFeliz ya quedo "asignado" en el subtest de camino feliz
    const res = await request(app)
      .post(`${BASE}/${idAsignacionFeliz}/asignar`)
      .send({ repartidorId: '3' });

    assert.equal(res.status, 409);
    assert.match(res.body.mensaje, /no esta pendiente/);
  });

  await t.test('asignar: repartidor inexistente devuelve 404', async () => {
    const alta = await request(app).post(BASE).send({
      cliente: 'Cliente Repartidor Inexistente',
      direccion: 'Calle Inexistente 1',
      zona: 'Centro',
      importe: 500,
    });
    idRepartidorInexistente = alta.body.id;

    const res = await request(app)
      .post(`${BASE}/${idRepartidorInexistente}/asignar`)
      .send({ repartidorId: '999' });

    assert.equal(res.status, 404);
    assert.match(res.body.mensaje, /Repartidor no encontrado/);
  });

  await t.test('asignar: sin repartidorId devuelve 400', async () => {
    const res = await request(app)
      .post(`${BASE}/${idRepartidorInexistente}/asignar`)
      .send({});

    assert.equal(res.status, 400);
    assert.match(res.body.mensaje, /Falta el repartidorId/);
  });

  await t.test('en-camino: camino feliz pasa de "asignado" a "en_camino"', async () => {
    const res = await request(app).post(`${BASE}/${idAsignacionFeliz}/en-camino`);
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'en_camino');
  });

  await t.test('en-camino: pedido no asignado devuelve 409', async () => {
    // idRepartidorOcupado sigue pendiente (el intento de asignar fallo)
    const res = await request(app).post(`${BASE}/${idRepartidorOcupado}/en-camino`);
    assert.equal(res.status, 409);
    assert.match(res.body.mensaje, /no esta asignado/);
  });

  await t.test('entregar: camino feliz pasa a "entregado" y libera al repartidor', async () => {
    const res = await request(app).post(`${BASE}/${idAsignacionFeliz}/entregar`);
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'entregado');
    assert.ok(res.body.horaEntrega);

    // repartidor '2' (Carlos) quedo libre otra vez: se lo puede volver a asignar
    const alta = await request(app).post(BASE).send({
      cliente: 'Chequeo repartidor liberado',
      direccion: 'Calle Chequeo 1',
      zona: 'Centro',
      importe: 100,
    });
    const reasignado = await request(app)
      .post(`${BASE}/${alta.body.id}/asignar`)
      .send({ repartidorId: '2' });
    assert.equal(reasignado.status, 200);

    // se libera de nuevo para no dejar estado colgando de mas
    await request(app).post(`${BASE}/${alta.body.id}/liberar`);
  });

  await t.test('entregar: pedido sin asignar (no esta "en_camino") devuelve 409', async () => {
    // idRepartidorOcupado sigue pendiente
    const res = await request(app).post(`${BASE}/${idRepartidorOcupado}/entregar`);
    assert.equal(res.status, 409);
    assert.match(res.body.mensaje, /no esta en camino/);
  });

  await t.test('liberar: camino feliz vuelve el pedido a "pendiente" y libera al repartidor', async () => {
    // repartidor '3' (Lucia) esta libre en la semilla
    const asignado = await request(app)
      .post(`${BASE}/${idRepartidorOcupado}/asignar`)
      .send({ repartidorId: '3' });
    assert.equal(asignado.status, 200);

    const res = await request(app).post(`${BASE}/${idRepartidorOcupado}/liberar`);
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'pendiente');
    assert.equal(res.body.repartidorId, null);
    assert.equal(res.body.repartidor, null);
    assert.equal(res.body.horaAsignacion, null);

    // repartidor '3' quedo libre otra vez
    const alta = await request(app).post(BASE).send({
      cliente: 'Chequeo repartidor liberado 2',
      direccion: 'Calle Chequeo 2',
      zona: 'Centro',
      importe: 100,
    });
    const reasignado = await request(app)
      .post(`${BASE}/${alta.body.id}/asignar`)
      .send({ repartidorId: '3' });
    assert.equal(reasignado.status, 200);
    await request(app).post(`${BASE}/${alta.body.id}/liberar`);
  });

  await t.test('liberar: pedido que no esta asignado devuelve 409', async () => {
    // idRepartidorOcupado volvio a "pendiente" en el subtest anterior
    const res = await request(app).post(`${BASE}/${idRepartidorOcupado}/liberar`);
    assert.equal(res.status, 409);
    assert.match(res.body.mensaje, /no esta asignado/);
  });

  await t.test('cancelar: camino feliz cancela un pedido pendiente con motivo', async () => {
    // idRepartidorOcupado sigue pendiente
    const res = await request(app)
      .post(`${BASE}/${idRepartidorOcupado}/cancelar`)
      .send({ motivo: 'El cliente se arrepintio' });

    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'cancelado');
    assert.equal(res.body.motivoCancelacion, 'El cliente se arrepintio');
  });

  await t.test('cancelar: sin motivo devuelve 400', async () => {
    const alta = await request(app).post(BASE).send({
      cliente: 'Cliente Cancelar Sin Motivo',
      direccion: 'Calle Sin Motivo 1',
      zona: 'Centro',
      importe: 300,
    });
    idCancelarSinMotivo = alta.body.id;

    const res = await request(app).post(`${BASE}/${idCancelarSinMotivo}/cancelar`).send({});
    assert.equal(res.status, 400);
    assert.match(res.body.mensaje, /Falta el motivo/);
  });

  await t.test('cancelar: pedido ya entregado devuelve 409', async () => {
    // idAsignacionFeliz quedo "entregado" en el subtest de entregar
    const res = await request(app)
      .post(`${BASE}/${idAsignacionFeliz}/cancelar`)
      .send({ motivo: 'Intento tardio' });

    assert.equal(res.status, 409);
    assert.match(res.body.mensaje, /No se puede cancelar un pedido entregado/);
  });

  await t.test('id inexistente devuelve 404 en cada accion', async () => {
    const idFantasma = '99999';

    const asignar = await request(app).post(`${BASE}/${idFantasma}/asignar`).send({ repartidorId: '2' });
    assert.equal(asignar.status, 404);
    assert.match(asignar.body.mensaje, /Pedido no encontrado/);

    const enCamino = await request(app).post(`${BASE}/${idFantasma}/en-camino`);
    assert.equal(enCamino.status, 404);
    assert.match(enCamino.body.mensaje, /Pedido no encontrado/);

    const entregar = await request(app).post(`${BASE}/${idFantasma}/entregar`);
    assert.equal(entregar.status, 404);
    assert.match(entregar.body.mensaje, /Pedido no encontrado/);

    const liberar = await request(app).post(`${BASE}/${idFantasma}/liberar`);
    assert.equal(liberar.status, 404);
    assert.match(liberar.body.mensaje, /Pedido no encontrado/);

    const cancelar = await request(app).post(`${BASE}/${idFantasma}/cancelar`).send({ motivo: 'x' });
    assert.equal(cancelar.status, 404);
    assert.match(cancelar.body.mensaje, /Pedido no encontrado/);
  });

  await t.test('id mal formado no rompe el server: devuelve 404 igual que uno inexistente', async () => {
    const idsMalFormados = ['abc-123', '¿qué-id-es-esto?', '---', '00001'];

    for (const idRaro of idsMalFormados) {
      const res = await request(app)
        .post(`${BASE}/${encodeURIComponent(idRaro)}/asignar`)
        .send({ repartidorId: '2' });

      assert.equal(res.status, 404, `esperaba 404 para id "${idRaro}"`);
      assert.match(res.body.mensaje, /Pedido no encontrado/);
    }
  });
});
