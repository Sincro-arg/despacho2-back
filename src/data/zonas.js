// Las 4 zonas de envio son fijas: no se crean ni se borran en runtime.
const zonas = [
  { nombre: 'centro', recargoEnvio: 100 },
  { nombre: 'norte', recargoEnvio: 150 },
  { nombre: 'sur', recargoEnvio: 150 },
  { nombre: 'costa', recargoEnvio: 250 },
];

function getAll() {
  return zonas;
}

function getByNombre(nombre) {
  return zonas.find((z) => z.nombre === nombre);
}

module.exports = { getAll, getByNombre };
