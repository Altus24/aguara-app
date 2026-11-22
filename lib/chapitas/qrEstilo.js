const STORAGE_KEY = "aguara_qr_estilo_v3";
const STORAGE_KEY_LEGACY_V2 = "aguara_qr_estilo_v2";
const STORAGE_KEY_LEGACY = "aguara_qr_estilo_v1";
const TEMPLATES_KEY = "aguara_qr_plantillas_v1";
const ACTIVE_TEMPLATE_KEY = "aguara_qr_plantilla_activa_v1";

/** DPI para rasterizar el SVG al tamaño físico de impresión. */
export const QR_PRINT_DPI = 300;

/** Paleta oficial del QR Aguará (ficha técnica). */
export const QR_BRAND = {
  modulos: "#0F172A",
  ojos: "#E05A17",
  fondo: "#FFFFFF",
  texto: "#0F172A",
};

export const QR_ECC_OPTIONS = [
  { id: "L", label: "Baja (L)", hint: "Patrón más simple · ~7% corrección" },
  { id: "M", label: "Media (M)", hint: "Equilibrio · ~15% corrección" },
  { id: "Q", label: "Alta (Q)", hint: "Patrón más denso · ~25% corrección" },
  { id: "H", label: "Máxima (H)", hint: "Máxima densidad · ~30% corrección" },
];

export const QR_NOMBRE_POSICIONES = [
  { id: "top", label: "Arriba" },
  { id: "bottom", label: "Abajo" },
];

/** Tamaños físicos permitidos (lado × lado). */
export const QR_TAMANO_OPTIONS = [
  { id: "min", cm: 1.5, label: "Mínimo", hint: "1.5 × 1.5 cm" },
  { id: "med", cm: 2, label: "Medio", hint: "2 × 2 cm" },
  { id: "max", cm: 3, label: "Máximo", hint: "3 × 3 cm" },
];

const QR_TAMANO_CM_VALUES = QR_TAMANO_OPTIONS.map((o) => o.cm);

export function snapTamanoCm(cm) {
  const n = Number(cm);
  if (!Number.isFinite(n)) return 2;
  let best = QR_TAMANO_CM_VALUES[0];
  let bestDiff = Math.abs(n - best);
  for (const value of QR_TAMANO_CM_VALUES) {
    const diff = Math.abs(n - value);
    if (diff < bestDiff) {
      best = value;
      bestDiff = diff;
    }
  }
  return best;
}

export const NOMBRE_TAMANO_PX_MIN = 5;
export const NOMBRE_TAMANO_PX_MAX = 50;

/** Espacio vertical entre el nombre y el QR (px). */
export const NOMBRE_ESPACIO_PX_MIN = 0;
export const NOMBRE_ESPACIO_PX_MAX = 80;

export const DEFAULT_QR_ESTILO = {
  tamano_cm: 2,
  nombre_posicion: "top",
  nombre_tamano: 40,
  nombre_espacio: 8,
  logo_porcentaje: 18,
  complejidad: "H",
  texto_marca: "AGUARÁ APP",
  margen_qr: 1,
  color_modulos: QR_BRAND.modulos,
  color_ojos: QR_BRAND.ojos,
  color_fondo: QR_BRAND.fondo,
  color_texto: QR_BRAND.texto,
  modulos_estilo: "rounded",
};

export function cmToPx(cm, dpi = QR_PRINT_DPI) {
  const n = Number(cm);
  if (!Number.isFinite(n)) return cmToPx(DEFAULT_QR_ESTILO.tamano_cm, dpi);
  return Math.max(80, Math.round((n / 2.54) * dpi));
}

export function pxToCm(px, dpi = QR_PRINT_DPI) {
  const n = Number(px);
  if (!Number.isFinite(n)) return DEFAULT_QR_ESTILO.tamano_cm;
  return Math.round(((n * 2.54) / dpi) * 10) / 10;
}

export function normalizeQrEstilo(raw = {}) {
  let tamanoCm = Number(raw.tamano_cm);
  if (!Number.isFinite(tamanoCm) && raw.tamano_final != null) {
    tamanoCm = pxToCm(raw.tamano_final);
  }
  if (!Number.isFinite(tamanoCm)) tamanoCm = DEFAULT_QR_ESTILO.tamano_cm;

  const snappedCm = snapTamanoCm(tamanoCm);
  const tamanoFinal = cmToPx(snappedCm);

  let nombreTamano = Number(raw.nombre_tamano);
  if (!Number.isFinite(nombreTamano) && raw.nombre_porcentaje != null) {
    const pct = Number(raw.nombre_porcentaje);
    if (Number.isFinite(pct) && tamanoFinal > 0) {
      nombreTamano = Math.round((tamanoFinal * pct) / 100);
    }
  }
  if (!Number.isFinite(nombreTamano) && raw.nombre_tamano_cm != null) {
    const cm = Number(raw.nombre_tamano_cm);
    if (Number.isFinite(cm)) nombreTamano = cmToPx(cm);
  }
  if (!Number.isFinite(nombreTamano)) nombreTamano = DEFAULT_QR_ESTILO.nombre_tamano;
  nombreTamano = Math.min(
    NOMBRE_TAMANO_PX_MAX,
    Math.max(NOMBRE_TAMANO_PX_MIN, Math.round(nombreTamano))
  );

  let nombreEspacio = Number(raw.nombre_espacio);
  if (!Number.isFinite(nombreEspacio)) nombreEspacio = DEFAULT_QR_ESTILO.nombre_espacio;
  nombreEspacio = Math.min(
    NOMBRE_ESPACIO_PX_MAX,
    Math.max(NOMBRE_ESPACIO_PX_MIN, Math.round(nombreEspacio)),
  );

  const logoPorcentaje = Number(raw.logo_porcentaje ?? DEFAULT_QR_ESTILO.logo_porcentaje);
  const complejidad = String(raw.complejidad || DEFAULT_QR_ESTILO.complejidad).toUpperCase();
  const nombrePosicion = String(raw.nombre_posicion || DEFAULT_QR_ESTILO.nombre_posicion);
  const modulosEstilo = String(raw.modulos_estilo || DEFAULT_QR_ESTILO.modulos_estilo).toLowerCase();

  function hexColor(value, fallback) {
    const v = String(value || "").trim();
    return /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : fallback;
  }

  return {
    tamano_cm: snappedCm,
    tamano_final: tamanoFinal,
    nombre_posicion: nombrePosicion === "bottom" ? "bottom" : "top",
    nombre_tamano: nombreTamano,
    nombre_espacio: nombreEspacio,
    logo_porcentaje: Math.min(40, Math.max(8, Number.isFinite(logoPorcentaje) ? Math.round(logoPorcentaje) : 22)),
    complejidad: ["L", "M", "Q", "H"].includes(complejidad) ? complejidad : "H",
    texto_marca:
      String(raw.texto_marca || DEFAULT_QR_ESTILO.texto_marca).slice(0, 40) || "AGUARÁ APP",
    margen_qr: Math.min(4, Math.max(0, Number(raw.margen_qr ?? 1) || 1)),
    color_modulos: hexColor(raw.color_modulos, QR_BRAND.modulos),
    color_ojos: hexColor(raw.color_ojos, QR_BRAND.ojos),
    color_fondo: hexColor(raw.color_fondo, QR_BRAND.fondo),
    color_texto: hexColor(raw.color_texto, QR_BRAND.texto),
    modulos_estilo: modulosEstilo === "square" ? "square" : "rounded",
  };
}

function estiloSinPx(estilo) {
  const n = normalizeQrEstilo(estilo);
  return {
    tamano_cm: n.tamano_cm,
    nombre_posicion: n.nombre_posicion,
    nombre_tamano: n.nombre_tamano,
    nombre_espacio: n.nombre_espacio,
    logo_porcentaje: n.logo_porcentaje,
    complejidad: n.complejidad,
    texto_marca: n.texto_marca,
    margen_qr: n.margen_qr,
    color_modulos: n.color_modulos,
    color_ojos: n.color_ojos,
    color_fondo: n.color_fondo,
    color_texto: n.color_texto,
    modulos_estilo: n.modulos_estilo,
  };
}

export function loadQrEstilo() {
  if (typeof window === "undefined") return normalizeQrEstilo(DEFAULT_QR_ESTILO);
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem(STORAGE_KEY_LEGACY_V2) ||
      window.localStorage.getItem(STORAGE_KEY_LEGACY);
    if (!raw) return normalizeQrEstilo(DEFAULT_QR_ESTILO);
    return normalizeQrEstilo(JSON.parse(raw));
  } catch {
    return normalizeQrEstilo(DEFAULT_QR_ESTILO);
  }
}

export function saveQrEstilo(estilo) {
  const next = normalizeQrEstilo(estilo);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estiloSinPx(next)));
  }
  return next;
}

function uid() {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function loadQrPlantillas() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .map((item) => ({
        id: String(item.id || uid()),
        nombre: String(item.nombre || "Sin nombre").slice(0, 60),
        estilo: estiloSinPx(item.estilo || item),
        actualizado_en: item.actualizado_en || null,
      }))
      .filter((item) => item.nombre);
  } catch {
    return [];
  }
}

function persistPlantillas(list) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
  }
  return list;
}

export function saveQrPlantilla(nombre, estilo, existingId = null) {
  const name = String(nombre || "").trim().slice(0, 60);
  if (!name) throw new Error("Indicá un nombre para la plantilla.");
  const list = loadQrPlantillas();
  const payload = {
    id: existingId || uid(),
    nombre: name,
    estilo: estiloSinPx(estilo),
    actualizado_en: new Date().toISOString(),
  };
  const idx = list.findIndex((item) => item.id === payload.id);
  if (idx >= 0) list[idx] = payload;
  else list.unshift(payload);
  persistPlantillas(list);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACTIVE_TEMPLATE_KEY, payload.id);
  }
  return payload;
}

export function deleteQrPlantilla(id) {
  const next = loadQrPlantillas().filter((item) => item.id !== id);
  persistPlantillas(next);
  if (typeof window !== "undefined" && window.localStorage.getItem(ACTIVE_TEMPLATE_KEY) === id) {
    window.localStorage.removeItem(ACTIVE_TEMPLATE_KEY);
  }
  return next;
}

export function getActivePlantillaId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_TEMPLATE_KEY);
}

export function setActivePlantillaId(id) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ACTIVE_TEMPLATE_KEY, id);
  else window.localStorage.removeItem(ACTIVE_TEMPLATE_KEY);
}
