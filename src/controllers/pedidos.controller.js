// Controladores del modulo /api/pedidos.
// Sin Express: el back no tiene dependencias externas (ver package.json), asi
// que esto trabaja directo con los objetos http.IncomingMessage/ServerResponse
// nativos, igual que ../server.js.

import { pedidos, siguienteIdPedidoNuevo } from '../data/pedidos.js';
import { aplicarRecargoZona } from '../data/zonas.js';
import { repartidores } from '../db.js';

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

function enviarJson(res, status, cuerpo) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(cuerpo === undefined ? '' : JSON.stringify(cuerpo));
}

function enviarError(res, status, mensaje) {
  enviarJson(res, status, { mensaje });
}

function horaActual() {
  const ahora = new Date();
  const hh = String(ahora.getHours()).padStart(2, '0');
  const mm = String(ahora.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function buscarPedido(id) {
  return pedidos.find((p) => p.id === id);
}

function liberarRepartidorDe(pedido) {
  if (!pedido.repartidorId) return;
  const rep = repartidores.find((r) => String(r.id) === String(pedido.repartidorId));
  if (rep) rep.libre = true;
}

function exigirEstado(res, pedido, estadoEsperado, mensaje) {
  if (pedido.estado !== estadoEsperado) {
    enviarError(res, 409, mensaje ?? `El pedido esta en estado '${pedido.estado}', se esperaba '${estadoEsperado}'`);
    return false;
  }
  return true;
}

export async function listarPedidos(req, res, url) {
  const estado = url.searchParams.get('estado');
  const resultado = estado ? pedidos.filter((p) => p.estado === estado) : pedidos;
  return enviarJson(res, 200, resultado);
}

export async function crearPedido(req, res) {
  const body = await leerCuerpo(req);
  if (!body.cliente || !body.direccion || !body.zona) {
    return enviarError(res, 400, 'Faltan datos del pedido');
  }
  const importeBase = Number(body.importe) || 0;
  const nuevo = {
    id: siguienteIdPedidoNuevo(),
    cliente: body.cliente,
    telefono: body.telefono ?? '',
    direccion: body.direccion,
    zona: body.zona,
    importeBase,
    importe: aplicarRecargoZona(importeBase, body.zona),
    items: body.items ?? '',
    estado: 'pendiente',
    repartidorId: null,
    repartidor: null,
    horaAsignacion: null,
    horaEntrega: null,
    demorado: false,
  };
  pedidos.push(nuevo);
  return enviarJson(res, 201, nuevo);
}

export async function asignarPedido(req, res, id) {
  const pedido = buscarPedido(id);
  if (!pedido) return enviarError(res, 404, 'Pedido no encontrado');
  if (!exigirEstado(res, pedido, 'pendiente', 'El pedido no esta pendiente')) return;

  const body = await leerCuerpo(req);
  if (!body.repartidorId) return enviarError(res, 400, 'Falta el repartidorId');

  const rep = repartidores.find((r) => String(r.id) === String(body.repartidorId));
  if (!rep) return enviarError(res, 404, 'Repartidor no encontrado');
  if (rep.estado !== 'activo') return enviarError(res, 409, 'El repartidor esta inactivo');
  if (!rep.libre) return enviarError(res, 409, 'El repartidor ya no esta libre');

  pedido.estado = 'asignado';
  pedido.repartidorId = rep.id;
  pedido.repartidor = rep.nombre;
  pedido.horaAsignacion = horaActual();
  rep.libre = false;
  return enviarJson(res, 200, pedido);
}

export async function marcarEnCamino(req, res, id) {
  const pedido = buscarPedido(id);
  if (!pedido) return enviarError(res, 404, 'Pedido no encontrado');
  if (!exigirEstado(res, pedido, 'asignado', 'El pedido no esta asignado')) return;
  pedido.estado = 'en_camino';
  return enviarJson(res, 200, pedido);
}

export async function marcarEntregado(req, res, id) {
  const pedido = buscarPedido(id);
  if (!pedido) return enviarError(res, 404, 'Pedido no encontrado');
  if (!exigirEstado(res, pedido, 'en_camino', 'El pedido no esta en camino')) return;
  pedido.estado = 'entregado';
  pedido.horaEntrega = horaActual();
  liberarRepartidorDe(pedido);
  return enviarJson(res, 200, pedido);
}

export async function liberarPedido(req, res, id) {
  const pedido = buscarPedido(id);
  if (!pedido) return enviarError(res, 404, 'Pedido no encontrado');
  if (!exigirEstado(res, pedido, 'asignado', 'El pedido no esta asignado')) return;
  liberarRepartidorDe(pedido);
  pedido.estado = 'pendiente';
  pedido.repartidorId = null;
  pedido.repartidor = null;
  pedido.horaAsignacion = null;
  return enviarJson(res, 200, pedido);
}

export async function cancelarPedido(req, res, id) {
  const pedido = buscarPedido(id);
  if (!pedido) return enviarError(res, 404, 'Pedido no encontrado');
  if (pedido.estado === 'entregado') {
    return enviarError(res, 409, 'No se puede cancelar un pedido entregado');
  }
  const body = await leerCuerpo(req);
  if (!body.motivo) {
    return enviarError(res, 400, 'Falta el motivo de cancelacion');
  }
  liberarRepartidorDe(pedido);
  pedido.estado = 'cancelado';
  pedido.motivoCancelacion = body.motivo;
  return enviarJson(res, 200, pedido);
}

export { enviarError };
