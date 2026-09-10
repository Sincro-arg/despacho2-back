// App HTTP para los modulos nuevos organizados como data/controllers/routes,
// montados bajo /api. Sin Express ni otras dependencias externas: el back
// las evita a proposito (ver README) para no depender de `npm install`.
//
// Convive con ./server.js (que sigue sirviendo /pedidos, /repartidores y
// /metricas sin prefijo, y es lo que usa hoy despacho2-front). Este archivo
// es el punto de entrada de la migracion a modulos por recurso bajo /api;
// por ahora solo trae pedidos.

import { createServer } from 'node:http';
import { rutaPedidos } from './routes/pedidos.routes.js';

const PUERTO = Number(process.env.PORT) || 3001;

function conCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function enviarJson(res, status, cuerpo) {
  conCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(cuerpo === undefined ? '' : JSON.stringify(cuerpo));
}

const app = createServer(async (req, res) => {
  conCors(res);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const partes = url.pathname.split('/').filter(Boolean);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.method === 'GET' && partes.length === 0) {
      return enviarJson(res, 200, { status: 'ok', servicio: 'despacho2-back (api)' });
    }

    if (partes[0] === 'api' && partes[1] === 'pedidos') {
      const manejado = await rutaPedidos(req, res, partes.slice(2), url);
      if (manejado) return;
    }

    return enviarJson(res, 404, { mensaje: 'Ruta no encontrada' });
  } catch (err) {
    return enviarJson(res, 500, { mensaje: err instanceof Error ? err.message : 'Error interno' });
  }
});

app.listen(PUERTO, () => {
  console.log(`despacho2-back (api) escuchando en http://localhost:${PUERTO}`);
});
