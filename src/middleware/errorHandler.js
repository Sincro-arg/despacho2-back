// Middleware central de errores: toda ruta que llame a next(err) termina aca.
// Nunca deja pasar un 500 con detalles internos: si el error no trae
// statusCode propio, se devuelve un mensaje generico.
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.statusCode ? err.message : 'Error interno del servidor.';
  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
