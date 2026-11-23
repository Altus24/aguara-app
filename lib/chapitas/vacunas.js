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

/** @param {string|null|undefined} fecha YYYY-MM-DD */
export function proximaFechaDesdeAplicacion(fecha) {
  if (!fecha) return null;
  const aplicada = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(aplicada.getTime())) return null;
  aplicada.setDate(aplicada.getDate() + VACUNA_VIGENCIA_DIAS);
  return aplicada.toISOString().slice(0, 10);
}

/**
 * Fecha de vencimiento: proxima_fecha cargada o aplicación + vigencia.
 * @param {{ fecha?: string|null, proxima_fecha?: string|null }} vacuna
 */
export function fechaVencimientoVacuna(vacuna) {
  if (vacuna?.proxima_fecha) return String(vacuna.proxima_fecha).slice(0, 10);
  return proximaFechaDesdeAplicacion(vacuna?.fecha);
}

/**
 * @param {{ fecha?: string|null, proxima_fecha?: string|null }} vacuna
 * @param {Date} [hoy]
 */
export function esVacunaVencida(vacuna, hoy = new Date()) {
  const vencimiento = fechaVencimientoVacuna(vacuna);
  if (!vencimiento) return false;
  const limite = new Date(`${vencimiento}T12:00:00`);
  if (Number.isNaN(limite.getTime())) return false;
  const ref = new Date(hoy);
  ref.setHours(12, 0, 0, 0);
  return ref > limite;
}

export function etiquetaEstadoVacuna(vacuna, hoy = new Date()) {
  return esVacunaVencida(vacuna, hoy) ? "Vencida" : null;
}

/**
 * Catálogo de vacunas de la especie + última colocación de cada una.
 * @param {string|null|undefined} especie
 * @param {Array<{ id: string, nombre: string, fecha?: string|null, proxima_fecha?: string|null }>} registros
 */
export function catalogoVacunasConEstado(especie, registros = []) {
  const disponibles = vacunasParaEspecie(especie);
  const byNombre = new Map();
  for (const v of registros || []) {
    const key = String(v.nombre || "").trim().toLowerCase();
    if (!key) continue;
    const prev = byNombre.get(key);
    if (!prev || new Date(v.fecha || 0) > new Date(prev.fecha || 0)) {
      byNombre.set(key, v);
    }
  }
  const usados = new Set();
  const filas = disponibles.map((nombre) => {
    const key = nombre.toLowerCase();
    usados.add(key);
    const ultima = byNombre.get(key) || null;
    const colocaciones = (registros || []).filter(
      (v) => String(v.nombre || "").trim().toLowerCase() === key,
    ).length;
    return {
      nombre,
      ultima,
      colocaciones,
      vencimiento: ultima ? fechaVencimientoVacuna(ultima) : null,
      vencida: ultima ? esVacunaVencida(ultima) : false,
    };
  });

  // Registros con nombre fuera del catálogo (p. ej. cargados a mano).
  for (const [key, ultima] of byNombre.entries()) {
    if (usados.has(key)) continue;
    const colocaciones = (registros || []).filter(
      (v) => String(v.nombre || "").trim().toLowerCase() === key,
    ).length;
    filas.push({
      nombre: ultima.nombre,
      ultima,
      colocaciones,
      vencimiento: fechaVencimientoVacuna(ultima),
      vencida: esVacunaVencida(ultima),
    });
  }
  return filas;
}
