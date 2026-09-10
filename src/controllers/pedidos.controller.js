// Controladores del modulo /api/pedidos.
// Sin Express: el back no tiene dependencias externas (ver package.json), asi
// que esto trabaja directo con los objetos http.IncomingMessage/ServerResponse
// nativos, igual que ../server.js.

import { pedidos, siguienteIdPedidoNuevo } from '../data/pedidos.js';
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
  const nuevo = {
    id: siguienteIdPedidoNuevo(),
    cliente: body.cliente,
    telefono: body.telefono ?? '',
    direccion: body.direccion,
    zona: body.zona,
    importe: Number(body.importe) || 0,
    items: body.items ?? '',
    estado: 'pendiente',
    repartidorId: null,
    repartidor: null,
    horaAsignacion: null,
    demorado: false,
  };
  pedidos.push(nuevo);
  return enviarJson(res, 201, nuevo);
}

export async function asignarPedido(req, res, id) {
  const pedido = buscarPedido(id);
  if (!pedido) return enviarError(res, 404, 'Pedido no encontrado');

  const body = await leerCuerpo(req);
  const rep = repartidores.find((r) => String(r.id) === String(body.repartidorId));
  if (!rep) return enviarError(res, 404, 'Repartidor no encontrado');

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
  pedido.estado = 'en_camino';
  return enviarJson(res, 200, pedido);
}

export async function marcarEntregado(req, res, id) {
  const pedido = buscarPedido(id);
  if (!pedido) return enviarError(res, 404, 'Pedido no encontrado');
  pedido.estado = 'entregado';
  liberarRepartidorDe(pedido);
  return enviarJson(res, 200, pedido);
}

export async function liberarPedido(req, res, id) {
  const pedido = buscarPedido(id);
  if (!pedido) return enviarError(res, 404, 'Pedido no encontrado');
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
