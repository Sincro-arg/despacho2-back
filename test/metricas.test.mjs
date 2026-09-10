// Tests del modulo /api/metricas (src/controllers/metricas.controller.js +
// src/routes/metricas.routes.js), montado en src/app.js.
//
// Igual que test/pedidos.test.mjs: usa el runner nativo de Node y supertest
// contra el http.Server de app.js. `node --test` aisla cada archivo en su
// propio proceso, asi que este archivo tiene su propia copia en memoria de
// src/data/pedidos.js y no interfiere con pedidos.test.mjs.
//
// En vez de pasar por los endpoints de /api/pedidos (que usan la hora real
// del sistema via horaActual()), este archivo vacia el array `pedidos` en
// memoria y carga una semilla propia con horarios armados a mano. Eso
// permite verificar valores exactos de tiempoPromedioEntregaMinutos y de la
// deteccion de demorados (>45 min sin entregar) sin que el resultado
// dependa de cuando se corra el test.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { pedidos } from '../src/data/pedidos.js';

const BASE = '/api/metricas';

after(() => {
  app.close();
});

// Devuelve la hora "HH:MM" correspondiente a `hace` minutos antes de ahora,
// dando la vuelta la medianoche si hace falta. Usar esto (en vez de horas
// fijas) es lo que hace que "45 minutos de demora" siga siendo 45 minutos
// sin importar la hora del dia en que corra el test.
function haceMinutos(hace) {
  const ahora = new Date();
  const actualMinutos = ahora.getHours() * 60 + ahora.getMinutes();
  const objetivo = (((actualMinutos - hace) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(objetivo / 60)).padStart(2, '0');
  const mm = String(objetivo % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function pedidoBase(overrides) {
  return {
    id: overrides.id,
    cliente: overrides.cliente ?? 'Cliente de prueba',
    telefono: '',
    direccion: 'Direccion de prueba',
    zona: 'Centro',
    importe: overrides.importe ?? 1000,
    items: '',
    estado: overrides.estado,
    repartidorId: overrides.repartidorId ?? null,
    repartidor: overrides.repartidor ?? null,
    horaAsignacion: overrides.horaAsignacion ?? null,
    horaEntrega: overrides.horaEntrega ?? null,
    demorado: false,
  };
}

function cargarSemillaDePrueba() {
  pedidos.length = 0;
  pedidos.push(
    // --- entregados: horas fijas, ida para calcular el promedio a mano ---
    // 20 min de entrega
    pedidoBase({
      id: 'e1',
      estado: 'entregado',
      importe: 1000,
      repartidorId: '1',
      repartidor: 'Ana Gomez',
      horaAsignacion: '10:00',
      horaEntrega: '10:20',
    }),
    // 40 min de entrega
    pedidoBase({
      id: 'e2',
      estado: 'entregado',
      importe: 2000,
      repartidorId: '2',
      repartidor: 'Carlos Ruiz',
      horaAsignacion: '11:00',
      horaEntrega: '11:40',
    }),
    // promedio esperado: (20 + 40) / 2 = 30

    // --- demorados: horas relativas a "ahora" ---
    // asignado hace 46 min: pasa el umbral de 45, tiene que aparecer
    pedidoBase({
      id: 'd1',
      estado: 'asignado',
      repartidorId: '1',
      repartidor: 'Ana Gomez',
      horaAsignacion: haceMinutos(46),
    }),
    // en_camino hace 60 min: tambien tiene que aparecer (no solo "asignado")
    pedidoBase({
      id: 'd2',
      estado: 'en_camino',
      repartidorId: '2',
      repartidor: 'Carlos Ruiz',
      horaAsignacion: haceMinutos(60),
    }),
    // asignado hace exactamente 45 min: el filtro es estricto (> 45), no
    // tiene que aparecer -- prueba el borde
    pedidoBase({
      id: 'd3-borde',
      estado: 'asignado',
      repartidorId: '3',
      repartidor: 'Lucia Fernandez',
      horaAsignacion: haceMinutos(45),
    }),
    // asignado hace 10 min: no demorado
    pedidoBase({
      id: 'nd1',
      estado: 'asignado',
      repartidorId: '4',
      repartidor: 'Otro repartidor',
      horaAsignacion: haceMinutos(10),
    }),
    // pendiente sin horaAsignacion: nunca puede ser demorado aunque este
    // "viejo", el controlador lo exige explicitamente
    pedidoBase({
      id: 'p1',
      estado: 'pendiente',
    }),
    // cancelado con horaAsignacion vieja: tampoco cuenta, no es asignado/en_camino
    pedidoBase({
      id: 'c1',
      estado: 'cancelado',
      horaAsignacion: haceMinutos(200),
    }),
  );
}

test('modulo de metricas', async (t) => {
  await t.test('GET /api/metricas calcula el tiempo promedio de entrega', async () => {
    cargarSemillaDePrueba();

    const res = await request(app).get(BASE);

    assert.equal(res.status, 200);
    assert.equal(res.body.entregados, 2);
    assert.equal(res.body.facturado, 3000);
    assert.equal(res.body.tiempoPromedioEntregaMinutos, 30);
  });

  await t.test('GET /api/metricas detecta los pedidos demorados (>45 min sin entregar)', async () => {
    cargarSemillaDePrueba();

    const res = await request(app).get(BASE);

    assert.equal(res.status, 200);

    const idsDemorados = res.body.pedidosDemorados.map((p) => p.id).sort();
    assert.deepEqual(idsDemorados, ['d1', 'd2']);

    const d1 = res.body.pedidosDemorados.find((p) => p.id === 'd1');
    assert.equal(d1.estado, 'asignado');
    assert.equal(d1.minutosDesdeAsignacion, 46);

    const d2 = res.body.pedidosDemorados.find((p) => p.id === 'd2');
    assert.equal(d2.estado, 'en_camino');
    assert.equal(d2.minutosDesdeAsignacion, 60);
  });

  await t.test('GET /api/metricas no marca como demorado el borde de 45 min ni estados no asignables', async () => {
    cargarSemillaDePrueba();

    const res = await request(app).get(BASE);

    const ids = res.body.pedidosDemorados.map((p) => p.id);
    assert.ok(!ids.includes('d3-borde'), 'exactamente 45 min no debe contar como demorado');
    assert.ok(!ids.includes('nd1'), 'un pedido reciente no debe contar como demorado');
    assert.ok(!ids.includes('p1'), 'un pendiente sin horaAsignacion no debe contar como demorado');
    assert.ok(!ids.includes('c1'), 'un cancelado no debe contar como demorado aunque tenga horaAsignacion vieja');
  });

  await t.test('GET /api/metricas cuenta porEstado y arma porRepartidor con las entregas', async () => {
    cargarSemillaDePrueba();

    const res = await request(app).get(BASE);

    assert.equal(res.body.porEstado.entregado, 2);
    assert.equal(res.body.porEstado.asignado, 3); // d1, d3-borde, nd1
    assert.equal(res.body.porEstado.en_camino, 1); // d2
    assert.equal(res.body.porEstado.pendiente, 1); // p1
    assert.equal(res.body.porEstado.cancelado, 1); // c1

    const porRepartidor = res.body.porRepartidor;
    assert.deepEqual(
      porRepartidor.find((r) => r.repartidorId === '1'),
      { repartidorId: '1', repartidor: 'Ana Gomez', entregas: 1 },
    );
    assert.deepEqual(
      porRepartidor.find((r) => r.repartidorId === '2'),
      { repartidorId: '2', repartidor: 'Carlos Ruiz', entregas: 1 },
    );
  });
});
