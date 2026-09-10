// Recargos de envio por zona, como porcentaje sobre el importe del pedido.
// Valores de referencia para desarrollo: no vienen de ningun pliego ni lista
// de precios del negocio (no hay ninguno en el proyecto). Confirmar los
// porcentajes reales con el area comercial antes de llevar esto a produccion.

export const RECARGOS_ZONA = {
  Centro: 0,
  Norte: 0.1,
  Sur: 0.1,
  Oeste: 0.15,
};

/** Recargo (0 a 1) para una zona. Comparacion sin mayusculas/minusculas ni
 * espacios; si la zona no esta en la tabla, no se aplica recargo. */
export function recargoDeZona(zona) {
  if (!zona) return 0;
  const clave = Object.keys(RECARGOS_ZONA).find(
    (z) => z.toLowerCase() === String(zona).trim().toLowerCase(),
  );
  return clave ? RECARGOS_ZONA[clave] : 0;
}

/** Aplica el recargo de la zona sobre un importe base, redondeando a
 * centavos para evitar errores de coma flotante. */
export function aplicarRecargoZona(importeBase, zona) {
  const recargo = recargoDeZona(zona);
  return Math.round(importeBase * (1 + recargo) * 100) / 100;
}
