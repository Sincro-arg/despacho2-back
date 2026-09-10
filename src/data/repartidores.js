const VEHICULOS = ['moto', 'bici'];
const ESTADOS = ['libre', 'en_ruta', 'descanso'];

// Semilla: arranca con 5 repartidores en estados distintos, algunos con
// entregas hechas para poder probar que la baja nunca borra el registro.
function semilla() {
  return [
    { id: 1, nombre: 'Juan Perez', telefono: '11-5555-0001', vehiculo: 'moto', estado: 'libre', activo: true, entregasHechas: 12 },
    { id: 2, nombre: 'Maria Lopez', telefono: '11-5555-0002', vehiculo: 'bici', estado: 'en_ruta', activo: true, entregasHechas: 5 },
    { id: 3, nombre: 'Carlos Gomez', telefono: '11-5555-0003', vehiculo: 'moto', estado: 'descanso', activo: true, entregasHechas: 0 },
    { id: 4, nombre: 'Ana Torres', telefono: '11-5555-0004', vehiculo: 'bici', estado: 'libre', activo: true, entregasHechas: 20 },
    { id: 5, nombre: 'Luis Fernandez', telefono: '11-5555-0005', vehiculo: 'moto', estado: 'en_ruta', activo: true, entregasHechas: 0 },
  ];
}

let repartidores = semilla();
let nextId = repartidores.length + 1;

// Vuelve al estado inicial. Lo usan los tests para no arrastrar cambios
// de un test a otro, ya que los datos viven solo en memoria.
function reset() {
  repartidores = semilla();
  nextId = repartidores.length + 1;
}

function getAll() {
  return repartidores;
}

function getById(id) {
  return repartidores.find((r) => r.id === id);
}

function create(datos) {
  const nuevo = {
    id: nextId++,
    nombre: datos.nombre,
    telefono: datos.telefono,
    vehiculo: datos.vehiculo,
    estado: datos.estado || 'libre',
    activo: true,
    entregasHechas: 0,
  };
  repartidores.push(nuevo);
  return nuevo;
}

function update(id, cambios) {
  const repartidor = getById(id);
  if (!repartidor) return null;
  Object.assign(repartidor, cambios);
  return repartidor;
}

// Baja logica: solo marca activo en false. El registro nunca se elimina
// del array, tenga o no entregas hechas.
function softDelete(id) {
  const repartidor = getById(id);
  if (!repartidor) return null;
  repartidor.activo = false;
  return repartidor;
}

module.exports = {
  VEHICULOS,
  ESTADOS,
  getAll,
  getById,
  create,
  update,
  softDelete,
  reset,
};
