# despacho2-back

Back de referencia para `despacho2-front`. Servidor HTTP minimo (sin
dependencias externas, solo modulos nativos de Node) con datos en memoria:
alcanza para levantar el tablero con datos reales en desarrollo. No hay
persistencia: al reiniciar el proceso, los datos vuelven al seed inicial.

## Requisitos

Node 18 o superior. No hace falta `npm install` (no tiene dependencias).

## Uso

```
npm start
```

Levanta en `http://localhost:3001` (o el puerto de la variable `PORT`).

## Levantar front + back juntos

1. En `despacho2-back`: `npm start` (puerto 3001).
2. En `despacho2-front`: `npm run dev` (puerto 5173). El `vite.config.ts`
   tiene un proxy que redirige `/pedidos`, `/repartidores` y `/metricas`
   hacia `http://localhost:3001`, asi que no hace falta configurar
   `VITE_API_URL` para desarrollo.

Si el back corre en otro puerto o hay que apuntar a un back desplegado,
usar la variable `VITE_API_URL` en el front (ver su README) en vez del
proxy.

## Endpoints

- `GET /pedidos?estado=pendiente|asignado|en_camino|entregado`
- `POST /pedidos` — body `{ cliente, telefono, direccion, zona, importe, items }`.
  El `importe` recibido se toma como base y se le suma el recargo de la zona
  (`src/data/zonas.js`); el pedido creado guarda `importeBase` (lo que mando
  el cliente) e `importe` (con el recargo ya aplicado, es el que se muestra
  y se factura).
- `POST /pedidos/:id/asignar` — body `{ repartidorId }`. Requiere pedido
  `pendiente` y repartidor `libre` (409 si no); pasa el pedido a `asignado`,
  guarda `horaAsignacion` y pone al repartidor no libre.
- `POST /pedidos/:id/en-camino` — requiere pedido `asignado` (409 si no).
- `POST /pedidos/:id/entregar` — requiere pedido `en_camino` (409 si no);
  guarda `horaEntrega` y libera al repartidor.
- `POST /pedidos/:id/liberar` — requiere pedido `asignado` (409 si no); lo
  vuelve a `pendiente` y libera al repartidor.
- `POST /pedidos/:id/cancelar` — body `{ motivo }` (400 si falta). Valido
  desde cualquier estado menos `entregado` (409 si ya esta entregado).
- `GET /repartidores`
- `POST /repartidores` — body `{ nombre, telefono, vehiculo }`
- `PUT /repartidores/:id` — body `{ nombre, telefono, vehiculo }`
- `DELETE /repartidores/:id` — baja logica (marca `estado: "inactivo"`)
- `GET /metricas`
- `GET /zonas` — las 4 zonas fijas con su recargo (`src/data/zonas.js`),
  por ejemplo `[{ "zona": "Centro", "recargo": 0 }, ...]`.

CORS habilitado para cualquier origen, para simplificar el uso sin proxy
(por ejemplo con `npm run preview` del front).

## Modulo /api/pedidos, /api/metricas y /api/zonas (nuevo, en migracion)

`src/app.js` es un segundo punto de entrada (`npm run start:api`) organizado
por recurso: `src/data/pedidos.js` (semilla), `src/controllers/pedidos.controller.js`
y `src/routes/pedidos.routes.js`, montado bajo `/api/pedidos` con los mismos
verbos que `/pedidos` (alta, `asignar`, `en-camino`, `entregar`, `liberar`,
`cancelar` con `motivo`). Reutiliza los repartidores de `src/db.js` para
`asignar`/`liberar`, pero tiene su propia semilla de pedidos (15, repartidos
en los 4 estados, con `horaAsignacion` y uno demorado).

`GET /api/zonas` expone lo mismo que `GET /zonas`, reutilizando
`src/data/zonas.js`.

`GET /api/metricas` (`src/controllers/metricas.controller.js`, sobre la
semilla de `/api/pedidos`) devuelve:
- `porEstado`: cantidad de pedidos por cada estado.
- `entregados` y `facturado`: cantidad y suma de `importe` de los entregados.
- `tiempoPromedioEntregaMinutos`: promedio de `horaEntrega - horaAsignacion`
  (en minutos) de los pedidos entregados que tienen ambas horas cargadas.
- `porRepartidor`: entregas por repartidor, ordenadas de mayor a menor.
- `pedidosDemorados`: pedidos `asignado`/`en_camino` con mas de 45 minutos
  desde `horaAsignacion` hasta ahora (se recalcula en cada request, no es
  un flag fijo).

Hoy convive con `server.js` sin reemplazarlo: `despacho2-front` sigue
apuntando a `/pedidos` y `/metricas` (sin prefijo) via el proxy de Vite, asi
que `start`/`dev` siguen levantando `server.js`. Falta decidir si esto
reemplaza a `server.js` (y entonces migrar tambien repartidores a `/api` y
actualizar el proxy del front) o si se mantienen los dos.
