// Servidor minimo sin dependencias externas (solo modulos nativos de Node),
// para no depender de `npm install` a la hora de levantar el back.
import { createServer } from 'node:http';
import { pedidos, repartidores, siguienteId, calcularMetricas } from './db.js';

const PUERTO = Number(process.env.PORT) || 3001;

function conCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function enviarJson(res, status, cuerpo) {
  conCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(cuerpo === undefined ? '' : JSON.stringify(cuerpo));
}

function enviarError(res, status, mensaje) {
  enviarJson(res, status, { mensaje });
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let datos = '';
    req.on('data', (chunk) => {
      datos += chunk;
    });
    req.on('end', () => {
      if (!datos) return resolve({});
      try {
        resolve(JSON.parse(datos));
      } catch {
        reject(new Error('JSON invalido'));
      }
    });
    req.on('error', reject);
  });
}

function liberarRepartidorDe(pedido) {
  if (!pedido.repartidor) return;
  const rep = repartidores.find((r) => r.nombre === pedido.repartidor);
  if (rep) rep.libre = true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const partes = url.pathname.split('/').filter(Boolean);

  if (req.method === 'OPTIONS') {
    conCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // GET / (healthcheck)
    if (req.method === 'GET' && partes.length === 0) {
      return enviarJson(res, 200, { status: 'ok', servicio: 'despacho2-back' });
    }

    // GET /pedidos?estado=...
    if (req.method === 'GET' && partes[0] === 'pedidos' && partes.length === 1) {
      const estado = url.searchParams.get('estado');
      const resultado = estado ? pedidos.filter((p) => p.estado === estado) : pedidos;
      return enviarJson(res, 200, resultado);
    }

    // POST /pedidos
    if (req.method === 'POST' && partes[0] === 'pedidos' && partes.length === 1) {
      const body = await leerCuerpo(req);
      if (!body.cliente || !body.direccion || !body.zona) {
        return enviarError(res, 400, 'Faltan datos del pedido');
      }
      const nuevo = {
        id: siguienteId('pedido'),
        cliente: body.cliente,
        telefono: body.telefono ?? '',
        direccion: body.direccion,
        zona: body.zona,
        importe: Number(body.importe) || 0,
        items: body.items ?? '',
        estado: 'pendiente',
        repartidor: null,
        demorado: false,
      };
      pedidos.push(nuevo);
      return enviarJson(res, 201, nuevo);
    }

    // POST /pedidos/:id/asignar|en-camino|entregar|liberar|cancelar
    if (req.method === 'POST' && partes[0] === 'pedidos' && partes.length === 3) {
      const [, id, accion] = partes;
      const pedido = pedidos.find((p) => p.id === id);
      if (!pedido) return enviarError(res, 404, 'Pedido no encontrado');

      if (accion === 'asignar') {
        const body = await leerCuerpo(req);
        const rep = repartidores.find((r) => String(r.id) === String(body.repartidorId));
        if (!rep) return enviarError(res, 404, 'Repartidor no encontrado');
        pedido.estado = 'asignado';
        pedido.repartidor = rep.nombre;
        rep.libre = false;
        return enviarJson(res, 200, pedido);
      }

      if (accion === 'en-camino') {
        pedido.estado = 'en_camino';
        return enviarJson(res, 200, pedido);
      }

      if (accion === 'entregar') {
        pedido.estado = 'entregado';
        liberarRepartidorDe(pedido);
        return enviarJson(res, 200, pedido);
      }

      if (accion === 'liberar') {
        liberarRepartidorDe(pedido);
        pedido.estado = 'pendiente';
        pedido.repartidor = null;
        return enviarJson(res, 200, pedido);
      }

      if (accion === 'cancelar') {
        const body = await leerCuerpo(req);
        liberarRepartidorDe(pedido);
        pedido.estado = 'cancelado';
        pedido.motivoCancelacion = body.motivo ?? '';
        return enviarJson(res, 200, pedido);
      }

      return enviarError(res, 404, 'Accion no reconocida');
    }

    // GET /repartidores
    if (req.method === 'GET' && partes[0] === 'repartidores' && partes.length === 1) {
      return enviarJson(res, 200, repartidores);
    }

    // POST /repartidores
    if (req.method === 'POST' && partes[0] === 'repartidores' && partes.length === 1) {
      const body = await leerCuerpo(req);
      if (!body.nombre || !body.telefono || !body.vehiculo) {
        return enviarError(res, 400, 'Faltan datos del repartidor');
      }
      const nuevo = {
        id: siguienteId('repartidor'),
        nombre: body.nombre,
        telefono: body.telefono,
        vehiculo: body.vehiculo,
        estado: 'activo',
        libre: true,
      };
      repartidores.push(nuevo);
      return enviarJson(res, 201, nuevo);
    }

    // PUT /repartidores/:id
    if (req.method === 'PUT' && partes[0] === 'repartidores' && partes.length === 2) {
      const rep = repartidores.find((r) => String(r.id) === partes[1]);
      if (!rep) return enviarError(res, 404, 'Repartidor no encontrado');
      const body = await leerCuerpo(req);
      if (body.nombre) rep.nombre = body.nombre;
      if (body.telefono) rep.telefono = body.telefono;
      if (body.vehiculo) rep.vehiculo = body.vehiculo;
      return enviarJson(res, 200, rep);
    }

    // DELETE /repartidores/:id (baja logica)
    if (req.method === 'DELETE' && partes[0] === 'repartidores' && partes.length === 2) {
      const rep = repartidores.find((r) => String(r.id) === partes[1]);
      if (!rep) return enviarError(res, 404, 'Repartidor no encontrado');
      rep.estado = 'inactivo';
      return enviarJson(res, 200, rep);
    }

    // GET /metricas
    if (req.method === 'GET' && partes[0] === 'metricas' && partes.length === 1) {
      return enviarJson(res, 200, calcularMetricas());
    }

    return enviarError(res, 404, 'Ruta no encontrada');
  } catch (err) {
    return enviarError(res, 500, err instanceof Error ? err.message : 'Error interno');
  }
});

server.listen(PUERTO, () => {
  console.log(`despacho2-back escuchando en http://localhost:${PUERTO}`);
});
