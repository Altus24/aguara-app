/** Vigencia estándar: 365 días desde la fecha de aplicación. */
export const VACUNA_VIGENCIA_DIAS = 365;

export const VACUNAS_PERRO = [
  "Puppy",
  "Quíntuple",
  "Séxtuple",
  "Antirrábica",
  "Bordetella",
];

export const VACUNAS_GATO = [
  "Triple felina",
  "Leucemia felina",
  "Antirrábica",
];

/** @param {string|null|undefined} especie */
export function vacunasParaEspecie(especie) {
  const e = String(especie || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (/gato|felin/.test(e)) return [...VACUNAS_GATO];
  if (/perro|canin|dog/.test(e)) return [...VACUNAS_PERRO];
  // Sin especie clara: ambas listas (sin duplicar Antirrábica)
  return [...VACUNAS_PERRO, ...VACUNAS_GATO.filter((v) => v !== "Antirrábica")];
}

/**
 * @param {{ fecha?: string|null, proxima_fecha?: string|null }} vacuna
 * @param {Date} [hoy]
 */
export function esVacunaVencida(vacuna, hoy = new Date()) {
  const fecha = vacuna?.fecha;
  if (!fecha) return false;
  const aplicada = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(aplicada.getTime())) return false;
  const limite = new Date(aplicada);
  limite.setDate(limite.getDate() + VACUNA_VIGENCIA_DIAS);
  const ref = new Date(hoy);
  ref.setHours(12, 0, 0, 0);
  return ref > limite;
}

export function etiquetaEstadoVacuna(vacuna, hoy = new Date()) {
  return esVacunaVencida(vacuna, hoy) ? "Vencida" : null;
}
