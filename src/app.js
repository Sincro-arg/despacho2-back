const express = require('express');
const repartidoresRoutes = require('./routes/repartidores.routes');
const pedidosRoutes = require('./routes/pedidos.routes');
const metricasRoutes = require('./routes/metricas.routes');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./errors/AppError');

const app = express();

app.use(express.json());

app.use('/api/repartidores', repartidoresRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/metricas', metricasRoutes);

app.use((req, res, next) => {
  next(new AppError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
});

app.use(errorHandler);

module.exports = app;
