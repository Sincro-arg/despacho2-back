const express = require('express');
const controller = require('../controllers/metricas.controller');

const router = express.Router();

router.get('/turno', controller.turno);

module.exports = router;
