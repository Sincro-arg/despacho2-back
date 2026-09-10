const request = require('supertest');
const app = require('../src/app');
const pedidosData = require('../src/data/pedidos');
const repartidoresData = require('../src/data/repartidores');

const AHORA = new Date('2026-01-15T12:00:00.000Z');

function minutosAntes(minutos) {
  return new Date(AHORA.getTime() - minutos * 60000).toISOString();
}

// Deja la tabla de pedidos vacia de casos "reales": cancela toda la semilla
// para que los pedidos que arma cada test sean los unicos que cuentan en
// las metricas de entregas/promedio/demora.
function limpiarSemillaDePedidos() {
  pedidosData.getAll().forEach((p) => {
    pedidosData.update(p.id, { estado: 'cancelado', repartidorId: null, asignadoEn: null, entregadoEn: null });
  });
}

function crearPedido() {
  return pedidosData.create({
    direccion: 'Test 1',
    zona: 'centro',
    cliente: 'Cliente Test',
    telefono: '11-0000-0000',
    items: [{ nombre: 'Item', cantidad: 1, precioUnitario: 100 }],
  });
}

beforeEach(() => {
  pedidosData.reset();
  repartidoresData.reset();
  jest.useFakeTimers({ doNotFake: ['nextTick'] });
  jest.setSystemTime(AHORA);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('GET /api/metricas/turno', () => {
  it('cuenta pedidos por estado y calcula entregados/totalFacturado sobre la semilla', async () => {
    const res = await request(app).get('/api/metricas/turno');
    expect(res.status).toBe(200);

    const pedidos = pedidosData.getAll();
    const porEstadoEsperado = pedidos.reduce((acc, p) => {
      acc[p.estado] = (acc[p.estado] || 0) + 1;
      return acc;
    }, {});
    expect(res.body.pedidosPorEstado).toMatchObject(porEstadoEsperado);

    const entregados = pedidos.filter((p) => p.estado === 'entregado');
    expect(res.body.entregados).toBe(entregados.length);

    const totalEsperado = entregados.reduce((acc, p) => acc + p.importe, 0);
    expect(res.body.totalFacturado).toBe(totalEsperado);
  });

  it('calcula el tiempo promedio de entrega exacto con datos armados a proposito', async () => {
    limpiarSemillaDePedidos();

    const p1 = crearPedido(); // 100 -> 80 min antes: tardo 20 min
    const p2 = crearPedido(); // 60 -> 30 min antes: tardo 30 min
    const p3 = crearPedido(); // 50 -> 10 min antes: tardo 40 min

    pedidosData.update(p1.id, { estado: 'entregado', repartidorId: 1, asignadoEn: minutosAntes(100), entregadoEn: minutosAntes(80) });
    pedidosData.update(p2.id, { estado: 'entregado', repartidorId: 1, asignadoEn: minutosAntes(60), entregadoEn: minutosAntes(30) });
    pedidosData.update(p3.id, { estado: 'entregado', repartidorId: 2, asignadoEn: minutosAntes(50), entregadoEn: minutosAntes(10) });

    const res = await request(app).get('/api/metricas/turno');
    expect(res.status).toBe(200);
    // (20 + 30 + 40) / 3 = 30 minutos exactos
    expect(res.body.tiempoPromedioEntregaMinutos).toBe(30);
  });

  it('devuelve null de tiempo promedio si no hay ningun pedido entregado', async () => {
    limpiarSemillaDePedidos();

    const res = await request(app).get('/api/metricas/turno');
    expect(res.status).toBe(200);
    expect(res.body.tiempoPromedioEntregaMinutos).toBeNull();
  });

  it('ordena las entregas por repartidor de mayor a menor', async () => {
    limpiarSemillaDePedidos();

    const pedidos = [crearPedido(), crearPedido(), crearPedido(), crearPedido(), crearPedido()];
    // Repartidor 4: 3 entregas. Repartidor 1: 2 entregas. Repartidor 3: 0.
    [1, 1, 4, 4, 4].forEach((repartidorId, i) => {
      pedidosData.update(pedidos[i].id, {
        estado: 'entregado',
        repartidorId,
        asignadoEn: minutosAntes(20),
        entregadoEn: minutosAntes(5),
      });
    });

    const res = await request(app).get('/api/metricas/turno');
    expect(res.status).toBe(200);

    const orden = res.body.entregasPorRepartidor.map((r) => r.repartidorId);
    expect(orden[0]).toBe(4);
    expect(orden[1]).toBe(1);
    expect(res.body.entregasPorRepartidor.find((r) => r.repartidorId === 4).entregas).toBe(3);
    expect(res.body.entregasPorRepartidor.find((r) => r.repartidorId === 1).entregas).toBe(2);
    expect(res.body.entregasPorRepartidor.find((r) => r.repartidorId === 3).entregas).toBe(0);

    // el orden general debe venir no creciente
    for (let i = 1; i < res.body.entregasPorRepartidor.length; i++) {
      expect(res.body.entregasPorRepartidor[i - 1].entregas).toBeGreaterThanOrEqual(res.body.entregasPorRepartidor[i].entregas);
    }
  });

  it('detecta como demorados solo los pedidos asignados hace mas de 45 minutos y sin entregar', async () => {
    limpiarSemillaDePedidos();

    const demoradoAsignado = crearPedido(); // 46 min: demorado
    const demoradoEnCamino = crearPedido(); // 50 min, en_camino: demorado
    const noDemoradoJusto = crearPedido(); // 44 min: no demorado
    const noDemoradoLimite = crearPedido(); // exactamente 45 min: no demorado (estricto)
    const entregadoTarde = crearPedido(); // asignado hace 60 min pero ya entregado: no cuenta
    const pendienteSinAsignar = crearPedido(); // nunca fue asignado: no cuenta

    pedidosData.update(demoradoAsignado.id, { estado: 'asignado', repartidorId: 1, asignadoEn: minutosAntes(46) });
    pedidosData.update(demoradoEnCamino.id, { estado: 'en_camino', repartidorId: 2, asignadoEn: minutosAntes(50) });
    pedidosData.update(noDemoradoJusto.id, { estado: 'asignado', repartidorId: 3, asignadoEn: minutosAntes(44) });
    pedidosData.update(noDemoradoLimite.id, { estado: 'asignado', repartidorId: 4, asignadoEn: minutosAntes(45) });
    pedidosData.update(entregadoTarde.id, {
      estado: 'entregado',
      repartidorId: 1,
      asignadoEn: minutosAntes(60),
      entregadoEn: minutosAntes(5),
    });
    // pendienteSinAsignar se deja tal cual: estado pendiente, sin asignadoEn.

    const res = await request(app).get('/api/metricas/turno');
    expect(res.status).toBe(200);

    const idsDemorados = res.body.pedidosDemorados.map((p) => p.id).sort((a, b) => a - b);
    expect(idsDemorados).toEqual([demoradoAsignado.id, demoradoEnCamino.id].sort((a, b) => a - b));
    expect(res.body.pedidosDemorados).toHaveLength(2);
  });
});
