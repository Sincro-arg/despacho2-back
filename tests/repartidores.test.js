const request = require('supertest');
const app = require('../src/app');
const repartidoresData = require('../src/data/repartidores');

beforeEach(() => {
  repartidoresData.reset();
});

describe('GET /api/repartidores', () => {
  it('devuelve la lista con los 5 repartidores de la semilla', async () => {
    const res = await request(app).get('/api/repartidores');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
  });
});

describe('GET /api/repartidores/:id', () => {
  it('devuelve un repartidor existente', async () => {
    const res = await request(app).get('/api/repartidores/1');
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Juan Perez');
  });

  it('responde 404 si el id no existe', async () => {
    const res = await request(app).get('/api/repartidores/999');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no existe/i);
  });

  it('responde 400 si el id esta mal formado', async () => {
    const res = await request(app).get('/api/repartidores/abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/id/i);
  });
});

describe('POST /api/repartidores', () => {
  it('crea un repartidor nuevo (camino feliz)', async () => {
    const res = await request(app).post('/api/repartidores').send({
      nombre: 'Pedro Ramirez',
      telefono: '11-5555-0006',
      vehiculo: 'moto',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(6);
    expect(res.body.estado).toBe('libre');
    expect(res.body.activo).toBe(true);
    expect(res.body.entregasHechas).toBe(0);
  });

  it('responde 400 si falta el nombre', async () => {
    const res = await request(app).post('/api/repartidores').send({
      telefono: '11-5555-0006',
      vehiculo: 'moto',
    });
    expect(res.status).toBe(400);
  });

  it('responde 400 si el vehiculo no es moto ni bici', async () => {
    const res = await request(app).post('/api/repartidores').send({
      nombre: 'Pedro Ramirez',
      telefono: '11-5555-0006',
      vehiculo: 'auto',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/vehiculo/i);
  });
});

describe('PUT /api/repartidores/:id', () => {
  it('edita los datos de un repartidor (camino feliz)', async () => {
    const res = await request(app).put('/api/repartidores/1').send({ telefono: '11-9999-0000' });
    expect(res.status).toBe(200);
    expect(res.body.telefono).toBe('11-9999-0000');
  });

  it('permite pasar a descanso a un repartidor que esta libre', async () => {
    const res = await request(app).put('/api/repartidores/1').send({ estado: 'descanso' });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('descanso');
  });

  it('bloquea el cambio a descanso si el repartidor esta en_ruta', async () => {
    // el repartidor 2 esta en_ruta en la semilla
    const res = await request(app).put('/api/repartidores/2').send({ estado: 'descanso' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/en_ruta/i);

    const sinCambios = await request(app).get('/api/repartidores/2');
    expect(sinCambios.body.estado).toBe('en_ruta');
  });

  it('responde 404 si el repartidor no existe', async () => {
    const res = await request(app).put('/api/repartidores/999').send({ estado: 'descanso' });
    expect(res.status).toBe(404);
  });

  it('responde 400 si el id esta mal formado', async () => {
    const res = await request(app).put('/api/repartidores/abc').send({ estado: 'descanso' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/repartidores/:id (baja logica)', () => {
  it('marca inactivo a un repartidor y lo sigue devolviendo en el listado', async () => {
    const res = await request(app).delete('/api/repartidores/3');
    expect(res.status).toBe(200);
    expect(res.body.activo).toBe(false);

    const getRes = await request(app).get('/api/repartidores/3');
    expect(getRes.status).toBe(200);
    expect(getRes.body.activo).toBe(false);
  });

  it('da de baja a un repartidor con entregas hechas sin borrar su registro', async () => {
    // el repartidor 1 tiene entregasHechas: 12 en la semilla
    const res = await request(app).delete('/api/repartidores/1');
    expect(res.status).toBe(200);
    expect(res.body.activo).toBe(false);
    expect(res.body.entregasHechas).toBe(12);

    const getRes = await request(app).get('/api/repartidores/1');
    expect(getRes.status).toBe(200);
    expect(getRes.body.entregasHechas).toBe(12);
  });

  it('responde 404 si el id no existe', async () => {
    const res = await request(app).delete('/api/repartidores/999');
    expect(res.status).toBe(404);
  });

  it('responde 400 si el id esta mal formado', async () => {
    const res = await request(app).delete('/api/repartidores/abc');
    expect(res.status).toBe(400);
  });
});
