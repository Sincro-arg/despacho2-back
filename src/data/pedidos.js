const zonasData = require('./zonas');

const ESTADOS = ['pendiente', 'asignado', 'en_camino', 'entregado', 'cancelado'];

// Suma el costo de los items mas el recargo fijo de la zona.
function calcularImporte(items, zonaNombre) {
  const subtotalItems = items.reduce((acc, item) => acc + item.cantidad * item.precioUnitario, 0);
  const zona = zonasData.getByNombre(zonaNombre);
  const recargo = zona ? zona.recargoEnvio : 0;
  return subtotalItems + recargo;
}

function hace(minutos) {
  return new Date(Date.now() - minutos * 60000).toISOString();
}

function armarPedido(id, datos) {
  return {
    id,
    direccion: datos.direccion,
    zona: datos.zona,
    cliente: datos.cliente,
    telefono: datos.telefono,
    items: datos.items,
    importe: calcularImporte(datos.items, datos.zona),
    estado: datos.estado,
    repartidorId: datos.repartidorId,
    creadoEn: hace(datos.creadoHaceMin),
    asignadoEn: datos.asignadoHaceMin != null ? hace(datos.asignadoHaceMin) : null,
    entregadoEn: datos.entregadoHaceMin != null ? hace(datos.entregadoHaceMin) : null,
    canceladoEn: null,
    motivoCancelacion: null,
  };
}

// Semilla: 15 pedidos repartidos entre los cuatro estados del flujo normal.
// El pedido 6 quedo asignado hace 50 minutos y sigue sin entregar (demorado).
// Los repartidorId usados coinciden con los repartidores en_ruta de la
// semilla de repartidores (2 y 5) para los pedidos activos.
function semilla() {
  const datos = [
    // Pendientes
    { direccion: 'Av. Rivadavia 1200', zona: 'centro', cliente: 'Sofia Ramos', telefono: '11-4000-0001', items: [{ nombre: 'Hamburguesa doble', cantidad: 2, precioUnitario: 900 }], estado: 'pendiente', repartidorId: null, creadoHaceMin: 15 },
    { direccion: 'Calle Falsa 123', zona: 'norte', cliente: 'Martin Diaz', telefono: '11-4000-0002', items: [{ nombre: 'Pizza grande', cantidad: 1, precioUnitario: 2200 }], estado: 'pendiente', repartidorId: null, creadoHaceMin: 12 },
    { direccion: 'Av. Belgrano 800', zona: 'sur', cliente: 'Lucia Fernandez', telefono: '11-4000-0003', items: [{ nombre: 'Ensalada caesar', cantidad: 1, precioUnitario: 1500 }, { nombre: 'Agua', cantidad: 2, precioUnitario: 300 }], estado: 'pendiente', repartidorId: null, creadoHaceMin: 8 },
    { direccion: 'Costanera 45', zona: 'costa', cliente: 'Diego Alvarez', telefono: '11-4000-0004', items: [{ nombre: 'Empanadas', cantidad: 6, precioUnitario: 250 }], estado: 'pendiente', repartidorId: null, creadoHaceMin: 6 },
    { direccion: 'San Martin 300', zona: 'centro', cliente: 'Valentina Ruiz', telefono: '11-4000-0005', items: [{ nombre: 'Sushi combo', cantidad: 1, precioUnitario: 3200 }], estado: 'pendiente', repartidorId: null, creadoHaceMin: 3 },

    // Asignado y demorado (mas de 45 minutos sin entregar)
    { direccion: 'Mitre 550', zona: 'norte', cliente: 'Federico Suarez', telefono: '11-4000-0006', items: [{ nombre: 'Milanesa napolitana', cantidad: 2, precioUnitario: 1800 }], estado: 'asignado', repartidorId: 2, creadoHaceMin: 60, asignadoHaceMin: 50 },

    // En camino
    { direccion: 'Peron 900', zona: 'sur', cliente: 'Camila Nunez', telefono: '11-4000-0007', items: [{ nombre: 'Tarta de verdura', cantidad: 1, precioUnitario: 1400 }], estado: 'en_camino', repartidorId: 5, creadoHaceMin: 30, asignadoHaceMin: 20 },

    // Entregados
    { direccion: 'Independencia 220', zona: 'centro', cliente: 'Rodrigo Paez', telefono: '11-4000-0008', items: [{ nombre: 'Cafe', cantidad: 2, precioUnitario: 500 }], estado: 'entregado', repartidorId: 1, creadoHaceMin: 180, asignadoHaceMin: 170, entregadoHaceMin: 150 },
    { direccion: 'Corrientes 1500', zona: 'norte', cliente: 'Julieta Gimenez', telefono: '11-4000-0009', items: [{ nombre: 'Lomito completo', cantidad: 1, precioUnitario: 2600 }], estado: 'entregado', repartidorId: 2, creadoHaceMin: 200, asignadoHaceMin: 190, entregadoHaceMin: 160 },
    { direccion: 'Salta 780', zona: 'sur', cliente: 'Nicolas Ortiz', telefono: '11-4000-0010', items: [{ nombre: 'Pastel de papa', cantidad: 3, precioUnitario: 1100 }], estado: 'entregado', repartidorId: 4, creadoHaceMin: 220, asignadoHaceMin: 210, entregadoHaceMin: 190 },
    { direccion: 'Costanera 900', zona: 'costa', cliente: 'Agustina Castro', telefono: '11-4000-0011', items: [{ nombre: 'Rabas', cantidad: 1, precioUnitario: 3400 }], estado: 'entregado', repartidorId: 5, creadoHaceMin: 240, asignadoHaceMin: 230, entregadoHaceMin: 210 },
    { direccion: 'Sarmiento 60', zona: 'centro', cliente: 'Tomas Molina', telefono: '11-4000-0012', items: [{ nombre: 'Wok de vegetales', cantidad: 1, precioUnitario: 1900 }], estado: 'entregado', repartidorId: 3, creadoHaceMin: 300, asignadoHaceMin: 290, entregadoHaceMin: 260 },
    { direccion: 'Roca 340', zona: 'norte', cliente: 'Micaela Vega', telefono: '11-4000-0013', items: [{ nombre: 'Sandwich de miga', cantidad: 4, precioUnitario: 700 }], estado: 'entregado', repartidorId: 1, creadoHaceMin: 320, asignadoHaceMin: 310, entregadoHaceMin: 290 },
    { direccion: 'Alberdi 210', zona: 'sur', cliente: 'Bruno Herrera', telefono: '11-4000-0014', items: [{ nombre: 'Fideos con salsa', cantidad: 2, precioUnitario: 1200 }], estado: 'entregado', repartidorId: 4, creadoHaceMin: 340, asignadoHaceMin: 330, entregadoHaceMin: 300 },
    { direccion: 'Colon 150', zona: 'costa', cliente: 'Florencia Acosta', telefono: '11-4000-0015', items: [{ nombre: 'Pescado a la parrilla', cantidad: 1, precioUnitario: 2800 }], estado: 'entregado', repartidorId: 2, creadoHaceMin: 360, asignadoHaceMin: 350, entregadoHaceMin: 320 },
  ];

  return datos.map((d, index) => armarPedido(index + 1, d));
}

let pedidos = semilla();
let nextId = pedidos.length + 1;

// Vuelve al estado inicial. Lo usan los tests para no arrastrar cambios
// de un test a otro, ya que los datos viven solo en memoria.
function reset() {
  pedidos = semilla();
  nextId = pedidos.length + 1;
}

function getAll() {
  return pedidos;
}

function getById(id) {
  return pedidos.find((p) => p.id === id);
}

function create(datos) {
  const nuevo = {
    id: nextId++,
    direccion: datos.direccion,
    zona: datos.zona,
    cliente: datos.cliente,
    telefono: datos.telefono,
    items: datos.items,
    importe: calcularImporte(datos.items, datos.zona),
    estado: 'pendiente',
    repartidorId: null,
    creadoEn: new Date().toISOString(),
    asignadoEn: null,
    entregadoEn: null,
    canceladoEn: null,
    motivoCancelacion: null,
  };
  pedidos.push(nuevo);
  return nuevo;
}

function update(id, cambios) {
  const pedido = getById(id);
  if (!pedido) return null;
  Object.assign(pedido, cambios);
  return pedido;
}

module.exports = {
  ESTADOS,
  calcularImporte,
  getAll,
  getById,
  create,
  update,
  reset,
};
