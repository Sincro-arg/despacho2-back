const express = require('express');
const controller = require('../controllers/repartidores.controller');

const router = express.Router();

router.get('/', controller.listar);
router.get('/:id', controller.obtener);
router.post('/', controller.crear);
router.put('/:id', controller.editar);
router.delete('/:id', controller.baja);

module.exports = router;
