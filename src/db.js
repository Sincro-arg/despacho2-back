// Datos en memoria. Se reinician cada vez que se reinicia el proceso.
// Alcanza para desarrollo y para validar el front contra un back real;
// no hay persistencia en disco ni base de datos.

let siguienteIdPedido = 6;
let siguienteIdRepartidor = 4;

export const repartidores = [
  {
    id: '1',
    nombre: 'Ana Gomez',
    telefono: '11-2233-4455',
    vehiculo: 'Moto',
    estado: 'activo',
    libre: false,
  },
  {
    id: '2',
    nombre: 'Carlos Ruiz',
    telefono: '11-5566-7788',
    vehiculo: 'Bici',
    estado: 'activo',
    libre: true,
  },
  {
    id: '3',
    nombre: 'Lucia Fernandez',
    telefono: '11-9900-1122',
    vehiculo: 'Auto',
    estado: 'inactivo',
    libre: true,
  },
];

export const pedidos = [
  {
    id: '1',
    cliente: 'Juan Perez',
    telefono: '11-1111-1111',
    direccion: 'Av. Siempre Viva 123',
    zona: 'Norte',
    importe: 1500,
    items: '2x Pizza muzzarella',
    estado: 'pendiente',
    repartidor: null,
    demorado: false,
  },
  {
    id: '2',
    cliente: 'Maria Diaz',
    telefono: '11-2222-2222',
    direccion: 'Calle Falsa 456',
    zona: 'Sur',
    importe: 2200,
    items: '1x Milanesa napolitana, 1x Coca 1.5L',
    estado: 'pendiente',
    repartidor: null,
    demorado: true,
  },
  {
    id: '3',
    cliente: 'Roberto Sosa',
    telefono: '11-3333-3333',
    direccion: 'Mitre 789',
    zona: 'Centro',
    importe: 1800,
    items: '3x Empanadas x6',
    estado: 'asignado',
    repartidor: 'Ana Gomez',
    demorado: false,
  },
  {
    id: '4',
    cliente: 'Lorena Paez',
    telefono: '11-4444-4444',
    direccion: 'Belgrano 321',
    zona: 'Oeste',
    importe: 3100,
    items: '1x Sushi combo',
    estado: 'en_camino',
    repartidor: 'Carlos Ruiz',
    demorado: false,
  },
  {
    id: '5',
    cliente: 'Diego Alvarez',
    telefono: '11-5555-5555',
    direccion: 'San Martin 654',
    zona: 'Norte',
    importe: 950,
    items: '1x Hamburguesa completa',
    estado: 'entregado',
    repartidor: 'Ana Gomez',
    demorado: false,
  },
];

export function siguienteId(tipo) {
  if (tipo === 'pedido') return String(siguienteIdPedido++);
  if (tipo === 'repartidor') return String(siguienteIdRepartidor++);
  throw new Error(`tipo de id desconocido: ${tipo}`);
}

export function calcularMetricas() {
  const entregados = pedidos.filter((p) => p.estado === 'entregado');
  const facturado = entregados.reduce((acc, p) => acc + p.importe, 0);
  const demorados = pedidos.filter((p) => p.demorado).length;

  const porRepartidorMap = new Map();
  for (const p of entregados) {
    if (!p.repartidor) continue;
    const rep = repartidores.find((r) => r.nombre === p.repartidor);
    const repartidorId = rep ? rep.id : p.repartidor;
    const actual = porRepartidorMap.get(repartidorId) ?? {
      repartidorId,
      repartidor: p.repartidor,
      entregas: 0,
    };
    actual.entregas += 1;
    porRepartidorMap.set(repartidorId, actual);
  }

  return {
    entregados: entregados.length,
    facturado,
    tiempoPromedioMinutos: 28,
    demorados,
    porRepartidor: Array.from(porRepartidorMap.values()),
  };
}
