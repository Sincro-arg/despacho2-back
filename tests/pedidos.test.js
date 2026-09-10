const request = require('supertest');
const app = require('../src/app');
const pedidosData = require('../src/data/pedidos');
const repartidoresData = require('../src/data/repartidores');

beforeEach(() => {
  pedidosData.reset();
  repartidoresData.reset();
});

describe('GET /api/pedidos', () => {
  it('devuelve la semilla con 15 pedidos repartidos entre los estados', async () => {
    const res = await request(app).get('/api/pedidos');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(15);

    const porEstado = res.body.reduce((acc, p) => {
      acc[p.estado] = (acc[p.estado] || 0) + 1;
      return acc;
    }, {});
    expect(porEstado.pendiente).toBeGreaterThan(0);
    expect(porEstado.asignado).toBeGreaterThan(0);
    expect(porEstado.en_camino).toBeGreaterThan(0);
    expect(porEstado.entregado).toBeGreaterThanOrEqual(5);
  });

  it('tiene al menos un pedido asignado hace mas de 45 minutos sin entregar', async () => {
    const res = await request(app).get('/api/pedidos');
    const demorados = res.body.filter((p) => {
      if (p.estado !== 'asignado') return false;
      const minutos = (Date.now() - new Date(p.asignadoEn).getTime()) / 60000;
      return minutos > 45;
    });
    expect(demorados.length).toBeGreaterThanOrEqual(1);
  });
});

describe('POST /api/pedidos', () => {
  it('crea un pedido sumando el recargo de la zona al importe (camino feliz)', async () => {
    const res = await request(app).post('/api/pedidos').send({
      direccion: 'Test 123',
      zona: 'centro',
      cliente: 'Cliente Test',
      telefono: '11-0000-0000',
      items: [{ nombre: 'Item', cantidad: 2, precioUnitario: 500 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('pendiente');
    expect(res.body.importe).toBe(2 * 500 + 100); // recargo de centro = 100
  });

  it('responde 400 si la zona no es una de las cuatro validas', async () => {
    const res = await request(app).post('/api/pedidos').send({
      direccion: 'Test 123',
      zona: 'oeste',
      cliente: 'Cliente Test',
      telefono: '11-0000-0000',
      items: [{ nombre: 'Item', cantidad: 1, precioUnitario: 500 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/zona/i);
  });

  it('responde 400 si no trae items', async () => {
    const res = await request(app).post('/api/pedidos').send({
      direccion: 'Test 123',
      zona: 'centro',
      cliente: 'Cliente Test',
      telefono: '11-0000-0000',
      items: [],
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/pedidos/:id/asignar', () => {
  it('asigna un pedido pendiente a un repartidor libre (camino feliz)', async () => {
    // pedido 1 pendiente, repartidor 1 (Juan Perez) libre en la semilla
    const res = await request(app).post('/api/pedidos/1/asignar').send({ repartidorId: 1 });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('asignado');
    expect(res.body.repartidorId).toBe(1);

    const repartidor = await request(app).get('/api/repartidores/1');
    expect(repartidor.body.estado).toBe('en_ruta');
  });

  it('responde 409 si el repartidor no esta libre (esta ocupado)', async () => {
    // pedido 3 pendiente, repartidor 2 esta en_ruta en la semilla
    const res = await request(app).post('/api/pedidos/3/asignar').send({ repartidorId: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/en_ruta/i);
  });

  it('responde 409 si el pedido no esta pendiente', async () => {
    // pedido 6 ya esta asignado en la semilla
    const res = await request(app).post('/api/pedidos/6/asignar').send({ repartidorId: 4 });
    expect(res.status).toBe(409);
  });

  it('responde 404 si el pedido no existe', async () => {
    const res = await request(app).post('/api/pedidos/999/asignar').send({ repartidorId: 1 });
    expect(res.status).toBe(404);
  });

  it('responde 404 si el repartidor no existe', async () => {
    const res = await request(app).post('/api/pedidos/1/asignar').send({ repartidorId: 999 });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/pedidos/:id/en-camino', () => {
  it('pasa un pedido asignado a en_camino (camino feliz)', async () => {
    // pedido 6 esta asignado en la semilla
    const res = await request(app).post('/api/pedidos/6/en-camino').send();
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('en_camino');
  });

  it('responde 409 si el pedido no esta asignado', async () => {
    // pedido 1 esta pendiente
    const res = await request(app).post('/api/pedidos/1/en-camino').send();
    expect(res.status).toBe(409);
  });

  it('responde 404 si el pedido no existe', async () => {
    const res = await request(app).post('/api/pedidos/999/en-camino').send();
    expect(res.status).toBe(404);
  });
});

describe('POST /api/pedidos/:id/entregar', () => {
  it('marca entregado un pedido en_camino, guarda la hora y libera al repartidor (camino feliz)', async () => {
    // pedido 7 esta en_camino con el repartidor 5 en la semilla
    const res = await request(app).post('/api/pedidos/7/entregar').send();
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('entregado');
    expect(res.body.entregadoEn).toBeTruthy();

    const repartidor = await request(app).get('/api/repartidores/5');
    expect(repartidor.body.estado).toBe('libre');
    expect(repartidor.body.entregasHechas).toBe(1); // tenia 0 en la semilla
  });

  it('responde 409 al intentar entregar un pedido que no esta en_camino (sin estar asignado)', async () => {
    // pedido 1 esta pendiente, nunca fue asignado
    const res = await request(app).post('/api/pedidos/1/entregar').send();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/en_camino/i);
  });

  it('responde 404 si el pedido no existe', async () => {
    const res = await request(app).post('/api/pedidos/999/entregar').send();
    expect(res.status).toBe(404);
  });
});

describe('POST /api/pedidos/:id/liberar', () => {
  it('libera un pedido asignado: vuelve a pendiente y el repartidor a libre (camino feliz)', async () => {
    // pedido 6 asignado al repartidor 2 en la semilla
    const res = await request(app).post('/api/pedidos/6/liberar').send();
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('pendiente');
    expect(res.body.repartidorId).toBeNull();

    const repartidor = await request(app).get('/api/repartidores/2');
    expect(repartidor.body.estado).toBe('libre');
  });

  it('responde 409 si el pedido no esta asignado (nunca tuvo repartidor)', async () => {
    // pedido 1 esta pendiente
    const res = await request(app).post('/api/pedidos/1/liberar').send();
    expect(res.status).toBe(409);
  });

  it('responde 404 si el pedido no existe', async () => {
    const res = await request(app).post('/api/pedidos/999/liberar').send();
    expect(res.status).toBe(404);
  });
});

describe('POST /api/pedidos/:id/cancelar', () => {
  it('cancela un pedido pendiente con motivo (camino feliz)', async () => {
    const res = await request(app).post('/api/pedidos/2/cancelar').send({ motivo: 'El cliente se arrepintio' });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('cancelado');
    expect(res.body.motivoCancelacion).toBe('El cliente se arrepintio');
  });

  it('libera al repartidor si el pedido cancelado estaba asignado', async () => {
    // pedido 6 asignado al repartidor 2
    const res = await request(app).post('/api/pedidos/6/cancelar').send({ motivo: 'Direccion incorrecta' });
    expect(res.status).toBe(200);

    const repartidor = await request(app).get('/api/repartidores/2');
    expect(repartidor.body.estado).toBe('libre');
  });

  it('responde 400 si falta el motivo', async () => {
    const res = await request(app).post('/api/pedidos/1/cancelar').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/motivo/i);
  });

  it('responde 409 al intentar cancelar un pedido ya entregado', async () => {
    // pedido 8 esta entregado en la semilla
    const res = await request(app).post('/api/pedidos/8/cancelar').send({ motivo: 'Ya no lo quiero' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/entregado/i);
  });

  it('responde 404 si el pedido no existe', async () => {
    const res = await request(app).post('/api/pedidos/999/cancelar').send({ motivo: 'Motivo' });
    expect(res.status).toBe(404);
  });
});
