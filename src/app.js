const express = require('express');
const repartidoresRoutes = require('./routes/repartidores.routes');
const pedidosRoutes = require('./routes/pedidos.routes');
const metricasRoutes = require('./routes/metricas.routes');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./errors/AppError');

const app = express();

app.use(express.json());

// CORS minimo: el front corre en otro origen (puerto de Vite) y necesita
// poder pegarle a esta API desde el navegador.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use('/api/repartidores', repartidoresRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/metricas', metricasRoutes);

app.use((req, res, next) => {
  next(new AppError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
});

app.use(errorHandler);

module.exports = app;
