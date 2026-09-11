// Controlador del modulo /api/metricas.
// Sin Express: trabaja directo con los objetos http.IncomingMessage/
// ServerResponse nativos, igual que el resto del modulo /api (ver
// ../controllers/pedidos.controller.js).

import { pedidos, ESTADOS_PEDIDO } from '../data/pedidos.js';

const MINUTOS_DEMORA = 45;

function enviarJson(res, status, cuerpo) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(cuerpo === undefined ? '' : JSON.stringify(cuerpo));
}

function horaAMinutos(hora) {
  const [hh, mm] = hora.split(':').map(Number);
  return hh * 60 + mm;
}

function minutosAhora() {
  const ahora = new Date();
  return ahora.getHours() * 60 + ahora.getMinutes();
}

// Diferencia en minutos entre dos horas "HH:MM" del mismo turno, asumiendo
// que `hasta` no cruza la medianoche respecto de `desde` mas de una vez.
function diferenciaMinutos(desde, hasta) {
  const diff = horaAMinutos(hasta) - horaAMinutos(desde);
  return diff >= 0 ? diff : diff + 24 * 60;
}

// Igual que diferenciaMinutos, pero contra los minutos actuales ya
// calculados (evita formatear la hora de "ahora" solo para reparsearla).
function minutosTranscurridosDesde(horaInicio, ahoraMinutos) {
  const diff = ahoraMinutos - horaAMinutos(horaInicio);
  return diff >= 0 ? diff : diff + 24 * 60;
}

/**
 * Calcula las metricas del turno a partir de `pedidos` (estado actual en
 * memoria). Pura y sincronica: no toca req/res, para poder testearla aparte.
 */
export function calcularMetricas() {
  const porEstado = Object.fromEntries(ESTADOS_PEDIDO.map((estado) => [estado, 0]));
  for (const p of pedidos) {
    porEstado[p.estado] = (porEstado[p.estado] ?? 0) + 1;
  }

  const entregados = pedidos.filter((p) => p.estado === 'entregado');
  const facturado = entregados.reduce((acc, p) => acc + p.importe, 0);

  const tiemposEntrega = entregados
    .filter((p) => p.horaAsignacion && p.horaEntrega)
    .map((p) => diferenciaMinutos(p.horaAsignacion, p.horaEntrega));
  const tiempoPromedioEntregaMinutos = tiemposEntrega.length
    ? Math.round(tiemposEntrega.reduce((a, b) => a + b, 0) / tiemposEntrega.length)
    : 0;

  const porRepartidorMap = new Map();
  for (const p of entregados) {
    if (!p.repartidorId) continue;
    const actual = porRepartidorMap.get(p.repartidorId) ?? {
      repartidorId: p.repartidorId,
      repartidor: p.repartidor,
      entregas: 0,
    };
    actual.entregas += 1;
    porRepartidorMap.set(p.repartidorId, actual);
  }
  const porRepartidor = Array.from(porRepartidorMap.values()).sort((a, b) => b.entregas - a.entregas);

  const ahoraMinutos = minutosAhora();
  const pedidosDemorados = pedidos
    .filter((p) => (p.estado === 'asignado' || p.estado === 'en_camino') && p.horaAsignacion)
    .map((p) => ({
      id: p.id,
      cliente: p.cliente,
      repartidorId: p.repartidorId,
      repartidor: p.repartidor,
      estado: p.estado,
      horaAsignacion: p.horaAsignacion,
      minutosDesdeAsignacion: minutosTranscurridosDesde(p.horaAsignacion, ahoraMinutos),
    }))
    .filter((p) => p.minutosDesdeAsignacion > MINUTOS_DEMORA);

  return {
    porEstado,
    entregados: entregados.length,
    facturado,
    tiempoPromedioEntregaMinutos,
    porRepartidor,
    pedidosDemorados,
  };
}

export async function obtenerMetricas(req, res) {
  return enviarJson(res, 200, calcularMetricas());
}
