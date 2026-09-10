const pedidosData = require('../data/pedidos');
const repartidoresData = require('../data/repartidores');
const zonasData = require('../data/zonas');
const AppError = require('../errors/AppError');

function parseId(valor, etiqueta = 'id') {
  if (!/^\d+$/.test(String(valor))) {
    throw new AppError(400, `El ${etiqueta} '${valor}' no es valido: debe ser un numero entero positivo.`);
  }
  return Number(valor);
}

function buscarPedidoOFallar(id) {
  const pedido = pedidosData.getById(id);
  if (!pedido) {
    throw new AppError(404, `No existe un pedido con id ${id}.`);
  }
  return pedido;
}

function buscarRepartidorOFallar(id) {
  const repartidor = repartidoresData.getById(id);
  if (!repartidor) {
    throw new AppError(404, `No existe un repartidor con id ${id}.`);
  }
  return repartidor;
}

function validarItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'El pedido debe tener al menos un item.');
  }
  items.forEach((item, index) => {
    if (!item || typeof item.nombre !== 'string' || !item.nombre.trim()) {
      throw new AppError(400, `El item en la posicion ${index} debe tener un nombre.`);
    }
    if (typeof item.cantidad !== 'number' || item.cantidad <= 0) {
      throw new AppError(400, `El item '${item.nombre}' debe tener una cantidad mayor a 0.`);
    }
    if (typeof item.precioUnitario !== 'number' || item.precioUnitario < 0) {
      throw new AppError(400, `El item '${item.nombre}' debe tener un precioUnitario valido.`);
    }
  });
}

function validarDatosCreacion(body) {
  const { direccion, zona, cliente, telefono, items } = body;
  if (!direccion || typeof direccion !== 'string') {
    throw new AppError(400, 'El campo direccion es obligatorio.');
  }
  if (!cliente || typeof cliente !== 'string') {
    throw new AppError(400, 'El campo cliente es obligatorio.');
  }
  if (!telefono || typeof telefono !== 'string') {
    throw new AppError(400, 'El campo telefono es obligatorio.');
  }
  if (!zonasData.getByNombre(zona)) {
    const nombres = zonasData.getAll().map((z) => z.nombre).join(', ');
    throw new AppError(400, `La zona debe ser una de: ${nombres}.`);
  }
  validarItems(items);
}

function listar(req, res) {
  const { estado } = req.query;
  const todos = pedidosData.getAll();
  if (estado) {
    return res.json(todos.filter((p) => p.estado === estado));
  }
  res.json(todos);
}

function obtener(req, res, next) {
  try {
    const id = parseId(req.params.id);
    res.json(buscarPedidoOFallar(id));
  } catch (err) {
    next(err);
  }
}

function crear(req, res, next) {
  try {
    validarDatosCreacion(req.body);
    const nuevo = pedidosData.create(req.body);
    res.status(201).json(nuevo);
  } catch (err) {
    next(err);
  }
}

// Solo si el pedido esta pendiente y el repartidor libre. El repartidor
// pasa a en_ruta.
function asignar(req, res, next) {
  try {
    const id = parseId(req.params.id, 'id de pedido');
    const pedido = buscarPedidoOFallar(id);
    const repartidorId = parseId(req.body.repartidorId, 'repartidorId');
    const repartidor = buscarRepartidorOFallar(repartidorId);

    if (pedido.estado !== 'pendiente') {
      throw new AppError(409, `El pedido esta '${pedido.estado}' y solo se puede asignar si esta pendiente.`);
    }
    if (!repartidor.activo) {
      throw new AppError(409, 'El repartidor esta dado de baja y no puede tomar pedidos.');
    }
    if (repartidor.estado !== 'libre') {
      throw new AppError(409, `El repartidor esta '${repartidor.estado}' y no puede tomar un pedido nuevo.`);
    }

    pedidosData.update(id, {
      estado: 'asignado',
      repartidorId,
      asignadoEn: new Date().toISOString(),
    });
    repartidoresData.update(repartidorId, { estado: 'en_ruta' });

    res.json(pedidosData.getById(id));
  } catch (err) {
    next(err);
  }
}

function marcarEnCamino(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const pedido = buscarPedidoOFallar(id);
    if (pedido.estado !== 'asignado') {
      throw new AppError(409, `El pedido esta '${pedido.estado}' y solo puede pasar a en_camino si esta asignado.`);
    }
    pedidosData.update(id, { estado: 'en_camino' });
    res.json(pedidosData.getById(id));
  } catch (err) {
    next(err);
  }
}

// Guarda la hora de entrega y devuelve al repartidor a libre.
function marcarEntregado(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const pedido = buscarPedidoOFallar(id);
    if (pedido.estado !== 'en_camino') {
      throw new AppError(409, `El pedido esta '${pedido.estado}' y solo se puede entregar si esta en_camino.`);
    }

    pedidosData.update(id, { estado: 'entregado', entregadoEn: new Date().toISOString() });

    if (pedido.repartidorId) {
      const repartidor = repartidoresData.getById(pedido.repartidorId);
      if (repartidor) {
        repartidoresData.update(repartidor.id, {
          estado: 'libre',
          entregasHechas: repartidor.entregasHechas + 1,
        });
      }
    }

    res.json(pedidosData.getById(id));
  } catch (err) {
    next(err);
  }
}

// El pedido vuelve a pendiente y el repartidor a libre.
function liberar(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const pedido = buscarPedidoOFallar(id);
    if (pedido.estado !== 'asignado' && pedido.estado !== 'en_camino') {
      throw new AppError(409, `El pedido esta '${pedido.estado}' y no tiene un repartidor asignado para liberar.`);
    }

    const repartidorId = pedido.repartidorId;
    pedidosData.update(id, { estado: 'pendiente', repartidorId: null, asignadoEn: null });
    if (repartidorId) {
      const repartidor = repartidoresData.getById(repartidorId);
      if (repartidor) {
        repartidoresData.update(repartidorId, { estado: 'libre' });
      }
    }

    res.json(pedidosData.getById(id));
  } catch (err) {
    next(err);
  }
}

// Alcanzable desde cualquier estado excepto entregado. Requiere motivo.
function cancelar(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const pedido = buscarPedidoOFallar(id);
    const { motivo } = req.body;

    if (pedido.estado === 'entregado') {
      throw new AppError(409, 'No se puede cancelar un pedido que ya fue entregado.');
    }
    if (pedido.estado === 'cancelado') {
      throw new AppError(409, 'El pedido ya esta cancelado.');
    }
    if (!motivo || typeof motivo !== 'string' || !motivo.trim()) {
      throw new AppError(400, 'El motivo de cancelacion es obligatorio.');
    }

    if (pedido.repartidorId) {
      const repartidor = repartidoresData.getById(pedido.repartidorId);
      if (repartidor) {
        repartidoresData.update(pedido.repartidorId, { estado: 'libre' });
      }
    }

    pedidosData.update(id, {
      estado: 'cancelado',
      motivoCancelacion: motivo,
      canceladoEn: new Date().toISOString(),
    });

    res.json(pedidosData.getById(id));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  obtener,
  crear,
  asignar,
  marcarEnCamino,
  marcarEntregado,
  liberar,
  cancelar,
};
