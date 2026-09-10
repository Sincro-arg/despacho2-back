const repartidoresData = require('../data/repartidores');
const AppError = require('../errors/AppError');

function parseId(param) {
  if (!/^\d+$/.test(param)) {
    throw new AppError(400, `El id '${param}' no es valido: debe ser un numero entero positivo.`);
  }
  return Number(param);
}

function buscarOFallar(id) {
  const repartidor = repartidoresData.getById(id);
  if (!repartidor) {
    throw new AppError(404, `No existe un repartidor con id ${id}.`);
  }
  return repartidor;
}

function validarDatosCreacion(body) {
  const { nombre, telefono, vehiculo, estado } = body;
  if (!nombre || typeof nombre !== 'string') {
    throw new AppError(400, 'El campo nombre es obligatorio.');
  }
  if (!telefono || typeof telefono !== 'string') {
    throw new AppError(400, 'El campo telefono es obligatorio.');
  }
  if (!repartidoresData.VEHICULOS.includes(vehiculo)) {
    throw new AppError(400, `El vehiculo debe ser uno de: ${repartidoresData.VEHICULOS.join(', ')}.`);
  }
  if (estado !== undefined && !repartidoresData.ESTADOS.includes(estado)) {
    throw new AppError(400, `El estado debe ser uno de: ${repartidoresData.ESTADOS.join(', ')}.`);
  }
}

function listar(req, res) {
  res.json(repartidoresData.getAll());
}

function obtener(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const repartidor = buscarOFallar(id);
    res.json(repartidor);
  } catch (err) {
    next(err);
  }
}

function crear(req, res, next) {
  try {
    validarDatosCreacion(req.body);
    const nuevo = repartidoresData.create(req.body);
    res.status(201).json(nuevo);
  } catch (err) {
    next(err);
  }
}

function editar(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const repartidor = buscarOFallar(id);

    const { nombre, telefono, vehiculo, estado } = req.body;
    const cambios = {};

    if (nombre !== undefined) cambios.nombre = nombre;
    if (telefono !== undefined) cambios.telefono = telefono;

    if (vehiculo !== undefined) {
      if (!repartidoresData.VEHICULOS.includes(vehiculo)) {
        throw new AppError(400, `El vehiculo debe ser uno de: ${repartidoresData.VEHICULOS.join(', ')}.`);
      }
      cambios.vehiculo = vehiculo;
    }

    if (estado !== undefined) {
      if (!repartidoresData.ESTADOS.includes(estado)) {
        throw new AppError(400, `El estado debe ser uno de: ${repartidoresData.ESTADOS.join(', ')}.`);
      }
      if (estado === 'descanso' && repartidor.estado === 'en_ruta') {
        throw new AppError(
          409,
          'Transicion invalida: el repartidor esta en_ruta y no puede pasar a descanso directamente.'
        );
      }
      cambios.estado = estado;
    }

    const actualizado = repartidoresData.update(id, cambios);
    res.json(actualizado);
  } catch (err) {
    next(err);
  }
}

function baja(req, res, next) {
  try {
    const id = parseId(req.params.id);
    buscarOFallar(id);
    const actualizado = repartidoresData.softDelete(id);
    res.json(actualizado);
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, obtener, crear, editar, baja };
