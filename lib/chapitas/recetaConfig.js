/** Valores por defecto de la plantilla de receta (diseño actual). */
export const RECETA_CONFIG_DEFAULTS = {
  color_acento: "#2f6fed",
  mostrar_logo: true,
  logo_tamano: 140,
  mostrar_telefono: true,
  mostrar_nombre_clinica: false,
  mostrar_direccion: false,
  texto_pie: "",
  etiqueta_profesional: "Veterinaria",
};

const LOGO_TAMANOS = new Set([80, 110, 140, 180]);

function asBool(value, fallback) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function asHexColor(value, fallback) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const [, a, b, c] = raw;
    return `#${a}${a}${b}${b}${c}${c}`.toLowerCase();
  }
  return fallback;
}

/**
 * Normaliza `clinicas.receta_config` (jsonb u objeto) a un shape seguro.
 * @param {unknown} raw
 */
export function normalizeRecetaConfig(raw) {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(raw);
              return parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? parsed
                : {};
            } catch {
              return {};
            }
          })()
        : {};

  const logoTamano = Number(src.logo_tamano);
  return {
    color_acento: asHexColor(src.color_acento, RECETA_CONFIG_DEFAULTS.color_acento),
    mostrar_logo: asBool(src.mostrar_logo, RECETA_CONFIG_DEFAULTS.mostrar_logo),
    logo_tamano: LOGO_TAMANOS.has(logoTamano)
      ? logoTamano
      : RECETA_CONFIG_DEFAULTS.logo_tamano,
    mostrar_telefono: asBool(
      src.mostrar_telefono,
      RECETA_CONFIG_DEFAULTS.mostrar_telefono,
    ),
    mostrar_nombre_clinica: asBool(
      src.mostrar_nombre_clinica,
      RECETA_CONFIG_DEFAULTS.mostrar_nombre_clinica,
    ),
    mostrar_direccion: asBool(
      src.mostrar_direccion,
      RECETA_CONFIG_DEFAULTS.mostrar_direccion,
    ),
    texto_pie: String(src.texto_pie || "").trim().slice(0, 280),
    etiqueta_profesional:
      String(src.etiqueta_profesional || "").trim().slice(0, 40) ||
      RECETA_CONFIG_DEFAULTS.etiqueta_profesional,
  };
}

/** Payload limpio para persistir en `clinicas.receta_config`. */
export function serializeRecetaConfig(raw) {
  return normalizeRecetaConfig(raw);
}

export function recetaConfigDeClinica(clinica) {
  return normalizeRecetaConfig(clinica?.receta_config);
}
