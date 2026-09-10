const pedidosData = require('../data/pedidos');
const repartidoresData = require('../data/repartidores');

// Un pedido asignado hace mas de este umbral y que todavia no fue entregado
// se considera demorado.
const UMBRAL_DEMORA_MIN = 45;

function contarPorEstado(pedidos) {
  return pedidosData.ESTADOS.reduce((acc, estado) => {
    acc[estado] = pedidos.filter((p) => p.estado === estado).length;
    return acc;
  }, {});
}

function calcularTotales(pedidos) {
  const entregados = pedidos.filter((p) => p.estado === 'entregado');
  const totalFacturado = entregados.reduce((acc, p) => acc + p.importe, 0);
  return { cantidadEntregados: entregados.length, totalFacturado };
}

// Promedio en minutos desde que se asigna hasta que se entrega, tomando
// solo los pedidos entregados que tienen ambas marcas de tiempo.
function calcularTiempoPromedioEntrega(pedidos) {
  const entregados = pedidos.filter((p) => p.estado === 'entregado' && p.asignadoEn && p.entregadoEn);
  if (entregados.length === 0) return null;
  const totalMinutos = entregados.reduce((acc, p) => {
    const minutos = (new Date(p.entregadoEn).getTime() - new Date(p.asignadoEn).getTime()) / 60000;
    return acc + minutos;
  }, 0);
  return totalMinutos / entregados.length;
}

// Cuenta entregas por pedidos reales (estado entregado), no por el contador
// entregasHechas del repartidor, para que la metrica siempre refleje el
// estado actual de los pedidos.
function calcularEntregasPorRepartidor(pedidos, repartidores) {
  const conteo = {};
  pedidos.forEach((p) => {
    if (p.estado === 'entregado' && p.repartidorId) {
      conteo[p.repartidorId] = (conteo[p.repartidorId] || 0) + 1;
    }
  });
  return repartidores
    .map((r) => ({ repartidorId: r.id, nombre: r.nombre, entregas: conteo[r.id] || 0 }))
    .sort((a, b) => b.entregas - a.entregas);
}

// Demorado: tiene asignadoEn, no esta entregado ni cancelado, y pasaron
// mas de UMBRAL_DEMORA_MIN minutos desde que se asigno.
function calcularDemorados(pedidos) {
  const ahora = Date.now();
  return pedidos.filter((p) => {
    if (p.estado === 'entregado' || p.estado === 'cancelado') return false;
    if (!p.asignadoEn) return false;
    const minutos = (ahora - new Date(p.asignadoEn).getTime()) / 60000;
    return minutos > UMBRAL_DEMORA_MIN;
  });
}

function turno(req, res) {
  const pedidos = pedidosData.getAll();
  const repartidores = repartidoresData.getAll();
  const { cantidadEntregados, totalFacturado } = calcularTotales(pedidos);

  res.json({
    pedidosPorEstado: contarPorEstado(pedidos),
    entregados: cantidadEntregados,
    totalFacturado,
    tiempoPromedioEntregaMinutos: calcularTiempoPromedioEntrega(pedidos),
    entregasPorRepartidor: calcularEntregasPorRepartidor(pedidos, repartidores),
    pedidosDemorados: calcularDemorados(pedidos),
  });
}

module.exports = { turno, UMBRAL_DEMORA_MIN };
