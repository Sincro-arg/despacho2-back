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
- `POST /pedidos` — body `{ cliente, telefono, direccion, zona, importe, items }`
- `POST /pedidos/:id/asignar` — body `{ repartidorId }`
- `POST /pedidos/:id/en-camino`
- `POST /pedidos/:id/entregar`
- `POST /pedidos/:id/liberar`
- `POST /pedidos/:id/cancelar` — body `{ motivo }`
- `GET /repartidores`
- `POST /repartidores` — body `{ nombre, telefono, vehiculo }`
- `PUT /repartidores/:id` — body `{ nombre, telefono, vehiculo }`
- `DELETE /repartidores/:id` — baja logica (marca `estado: "inactivo"`)
- `GET /metricas`

CORS habilitado para cualquier origen, para simplificar el uso sin proxy
(por ejemplo con `npm run preview` del front).
