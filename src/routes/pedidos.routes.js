// Ruteo del modulo /api/pedidos. `app.js` ya saco el prefijo '/api/pedidos'
// de `partes` antes de llamar a esta funcion.

import {
  listarPedidos,
  crearPedido,
  asignarPedido,
  marcarEnCamino,
  marcarEntregado,
  liberarPedido,
  cancelarPedido,
  enviarError,
} from '../controllers/pedidos.controller.js';

const ACCIONES = {
  asignar: asignarPedido,
  'en-camino': marcarEnCamino,
  entregar: marcarEntregado,
  liberar: liberarPedido,
  cancelar: cancelarPedido,
};

/**
 * @returns {Promise<boolean>} true si la ruta matcheo y ya respondio, false si no es de este modulo.
 */
export async function rutaPedidos(req, res, partes, url) {
  // GET /api/pedidos?estado=...
  if (req.method === 'GET' && partes.length === 0) {
    await listarPedidos(req, res, url);
    return true;
  }

  // POST /api/pedidos
  if (req.method === 'POST' && partes.length === 0) {
    await crearPedido(req, res);
    return true;
  }

  // POST /api/pedidos/:id/:accion
  if (req.method === 'POST' && partes.length === 2) {
    const [id, accion] = partes;
    const handler = ACCIONES[accion];
    if (!handler) {
      enviarError(res, 404, 'Accion no reconocida');
      return true;
    }
    await handler(req, res, id);
    return true;
  }

  return false;
}
