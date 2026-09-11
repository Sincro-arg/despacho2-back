// Ruteo del modulo /api/metricas. `app.js` ya saco el prefijo '/api/metricas'
// de `partes` antes de llamar a esta funcion.

import { obtenerMetricas } from '../controllers/metricas.controller.js';

/**
 * @returns {Promise<boolean>} true si la ruta matcheo y ya respondio, false si no es de este modulo.
 */
export async function rutaMetricas(req, res, partes) {
  // GET /api/metricas
  if (req.method === 'GET' && partes.length === 0) {
    await obtenerMetricas(req, res);
    return true;
  }

  return false;
}
