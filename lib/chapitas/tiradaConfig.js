import { CHAPITAS_PER_TIRADA, TIRADA_NUMERIC_BLOCK } from './chapitaId';
import { loadQrEstilo, loadQrPlantillas, normalizeQrEstilo } from './qrEstilo';

const STORAGE_KEY = 'aguara_tirada_config_v1';

export const TIRADA_CANTIDAD_OPTIONS = [40, 48, 80, 96, 165];

export const DEFAULT_TIRADA_CANTIDAD = 96;

/** Tiradas del inventario sin config guardada al crear (p. ej. T1 histórica). */
export const CANTIDAD_SIN_CONFIG = TIRADA_NUMERIC_BLOCK; // 100

export const DEFAULT_TIRADA_CONFIG = {
  cantidad: DEFAULT_TIRADA_CANTIDAD,
  plantilla_id: null,
};

const LEGACY_CANTIDAD_MAP = {
  25: 40,
  50: 48,
  75: 80,
  100: 96,
};

function clampCantidad(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return DEFAULT_TIRADA_CANTIDAD;
  const rounded = Math.round(num);
  if (TIRADA_CANTIDAD_OPTIONS.includes(rounded)) return rounded;
  if (LEGACY_CANTIDAD_MAP[rounded] != null) return LEGACY_CANTIDAD_MAP[rounded];
  let best = DEFAULT_TIRADA_CANTIDAD;
  let bestDiff = Math.abs(rounded - best);
  for (const opt of TIRADA_CANTIDAD_OPTIONS) {
    const diff = Math.abs(rounded - opt);
    if (diff < bestDiff) {
      best = opt;
      bestDiff = diff;
    }
  }
  return best;
}

export function normalizeTiradaConfig(raw = {}) {
  return {
    cantidad: clampCantidad(raw.cantidad ?? DEFAULT_TIRADA_CONFIG.cantidad),
    plantilla_id: raw.plantilla_id ? String(raw.plantilla_id) : null,
  };
}

export function loadAllTiradaConfigs() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out = {};
    for (const [key, value] of Object.entries(parsed)) {
      out[String(key)] = {
        ...normalizeTiradaConfig(value),
        definida: true,
      };
    }
    return out;
  } catch {
    return {};
  }
}

function persistAll(map) {
  if (typeof window !== 'undefined') {
    const toSave = {};
    for (const [key, value] of Object.entries(map)) {
      toSave[key] = {
        cantidad: value.cantidad,
        plantilla_id: value.plantilla_id ?? null,
      };
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }
  return map;
}

export function hasTiradaConfig(tirada) {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && typeof parsed === 'object' && parsed[String(tirada)]);
  } catch {
    return false;
  }
}

/**
 * Config de una tirada. Si no se guardó al crear, `definida: false`
 * y la cantidad es la del inventario histórico (100), no el default del formulario (96).
 */
export function getTiradaConfig(tirada) {
  const all = loadAllTiradaConfigs();
  const key = String(tirada);
  if (!all[key]) {
    return {
      cantidad: CANTIDAD_SIN_CONFIG,
      plantilla_id: null,
      definida: false,
    };
  }
  return all[key];
}

export function setTiradaConfig(tirada, patch) {
  const all = loadAllTiradaConfigs();
  const key = String(tirada);
  const next = {
    ...normalizeTiradaConfig({
      ...DEFAULT_TIRADA_CONFIG,
      ...all[key],
      ...patch,
    }),
    definida: true,
  };
  all[key] = next;
  persistAll(all);
  return next;
}

export function deleteTiradaConfig(tirada) {
  const all = loadAllTiradaConfigs();
  const key = String(tirada);
  if (!(key in all)) return loadAllTiradaConfigs();
  delete all[key];
  persistAll(all);
  return all;
}

export function clearAllTiradaConfigs() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return {};
}

export function resolveTiradaEstilo(tirada, fallbackEstilo) {
  const config = getTiradaConfig(tirada);
  if (config.definida && config.plantilla_id) {
    const plantilla = loadQrPlantillas().find((p) => p.id === config.plantilla_id);
    if (plantilla?.estilo) return normalizeQrEstilo(plantilla.estilo);
  }
  return normalizeQrEstilo(fallbackEstilo || loadQrEstilo());
}

export function plantillaLabel(plantillaId, definida = true) {
  if (!definida) return 'Sin definir';
  if (!plantillaId) return 'Estilo activo';
  const plantilla = loadQrPlantillas().find((p) => p.id === plantillaId);
  return plantilla?.nombre || 'Plantilla eliminada';
}

export { CHAPITAS_PER_TIRADA };
