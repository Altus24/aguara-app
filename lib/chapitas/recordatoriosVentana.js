/** Días de anticipación para mostrar y avisar vencimientos al tutor. */
export const RECORDATORIO_DIAS_ANTICIPO = 7;

/** @param {Date} [hoy] */
export function fechaHoyISO(hoy = new Date()) {
  return new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** @param {number} dias */
export function fechaMasDiasISO(dias, hoy = new Date()) {
  const d = new Date(hoy);
  d.setDate(d.getDate() + Number(dias || 0));
  return fechaHoyISO(d);
}

/**
 * @param {string|null|undefined} fecha
 * @param {Date} [hoy]
 */
export function diasHastaFecha(fecha, hoy = new Date()) {
  if (!fecha) return null;
  const f = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(f.getTime())) return null;
  const h = new Date(hoy);
  h.setHours(12, 0, 0, 0);
  return Math.round((f.getTime() - h.getTime()) / 86400000);
}

/**
 * Incluye hoy hasta N días (por defecto 7). No incluye vencidos.
 * @param {string|null|undefined} fecha
 * @param {number} [dias]
 * @param {Date} [hoy]
 */
export function enVentanaRecordatorio(fecha, dias = RECORDATORIO_DIAS_ANTICIPO, hoy = new Date()) {
  const d = diasHastaFecha(fecha, hoy);
  return d != null && d >= 0 && d <= dias;
}

/** @param {number|null|undefined} dias */
export function etiquetaDiasVencimiento(dias) {
  if (dias == null) return "";
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  return `vence en ${dias} días`;
}
