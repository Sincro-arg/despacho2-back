const express = require('express');
const controller = require('../controllers/pedidos.controller');

const router = express.Router();

router.get('/', controller.listar);
router.get('/:id', controller.obtener);
router.post('/', controller.crear);
router.post('/:id/asignar', controller.asignar);
router.post('/:id/en-camino', controller.marcarEnCamino);
router.post('/:id/entregar', controller.marcarEntregado);
router.post('/:id/liberar', controller.liberar);
router.post('/:id/cancelar', controller.cancelar);

module.exports = router;
