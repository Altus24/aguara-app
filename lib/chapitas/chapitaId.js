const LEGACY_ID_PATTERN = /^(0[0-9]{2}|100)$/;
const DYNAMIC_ID_PATTERN = /^[a-z0-9]{8}$/;
const TIRADA_T_ID_PATTERN = /^[Tt](\d+)-(\d{1,3})$/;
const NUMERIC_RANGE_PATTERN = /^\d{3,4}$/;

/** Capacidad máxima de IDs por tirada (cubre la opción 165). */
export const CHAPITAS_PER_TIRADA = 165;
/** Primeros 100 de tirada N≥2 siguen el bloque numérico histórico (200-299, 300-399…). */
export const TIRADA_NUMERIC_BLOCK = 100;
export const MAX_TIRADAS = 99;

export const isLegacyChapitaId = (id) => LEGACY_ID_PATTERN.test(String(id).trim());

export const isDynamicChapitaId = (id) => DYNAMIC_ID_PATTERN.test(String(id).trim().toLowerCase());

/** Mascota creada en el portal sin chapita física. */
export const DIGITAL_MASCOTA_ID_PATTERN = /^DIG-[a-f0-9]{12}$/i;

export const isDigitalMascotaId = (id) =>
  DIGITAL_MASCOTA_ID_PATTERN.test(String(id || "").trim());

export const newDigitalMascotaId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `DIG-${hex}`;
};

/**
 * Tirada 1: T1-001 … T1-165.
 * Tirada N≥2, seq 1–100: N00…N99 (ej. 200-299) — compatibilidad con QR ya impresos.
 * Tirada N≥2, seq 101–165: TN-101 … TN-165 (sin solapar el bloque numérico siguiente).
 */
export const formatTiradaChapitaId = (tirada, seq) => {
  if (tirada === 1 || seq > TIRADA_NUMERIC_BLOCK) {
    return `T${tirada}-${String(seq).padStart(3, '0')}`;
  }
  return String(tirada * TIRADA_NUMERIC_BLOCK + (seq - 1));
};

export const getTiradaIdRange = (tirada) => ({
  desde: formatTiradaChapitaId(tirada, 1),
  hasta: formatTiradaChapitaId(tirada, CHAPITAS_PER_TIRADA),
});

/** @returns {{ tirada: number, seq: number, web?: boolean, legacy?: boolean, numeric?: boolean } | null} */
export const parseChapitaTirada = (id) => {
  if (id == null) return null;
  const trimmed = String(id).trim();
  const lower = trimmed.toLowerCase();

  if (isDynamicChapitaId(lower)) {
    return { web: true, tirada: 0, seq: 0 };
  }

  const tMatch = TIRADA_T_ID_PATTERN.exec(trimmed);
  if (tMatch) {
    const tirada = parseInt(tMatch[1], 10);
    const seq = parseInt(tMatch[2], 10);
    if (tirada < 1 || tirada > MAX_TIRADAS || seq < 1 || seq > CHAPITAS_PER_TIRADA) {
      return null;
    }
    return { tirada, seq, web: false };
  }

  if (isLegacyChapitaId(trimmed)) {
    return { tirada: 1, seq: parseInt(trimmed, 10), web: false, legacy: true };
  }

  if (NUMERIC_RANGE_PATTERN.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    if (num < 101 || num > 9999) return null;
    const tirada = Math.floor(num / TIRADA_NUMERIC_BLOCK);
    const seq = (num % TIRADA_NUMERIC_BLOCK) + 1;
    if (tirada < 1 || tirada > MAX_TIRADAS || seq < 1 || seq > TIRADA_NUMERIC_BLOCK) {
      return null;
    }
    return { tirada, seq, web: false, numeric: true };
  }

  return null;
};

export const isTiradaChapitaId = (id) => {
  const parsed = parseChapitaTirada(id);
  return Boolean(parsed && !parsed.web);
};

export const normalizeChapitaId = (id) => {
  if (!id) return null;
  const trimmed = id.trim();

  const parsed = parseChapitaTirada(trimmed);
  if (!parsed || parsed.web) {
    return isDynamicChapitaId(trimmed.toLowerCase()) ? trimmed.toLowerCase() : null;
  }

  if (parsed.legacy) {
    return String(parsed.seq).padStart(3, '0');
  }

  return formatTiradaChapitaId(parsed.tirada, parsed.seq);
};

export const getChapitaSlotKey = (id) => {
  const parsed = parseChapitaTirada(id);
  if (!parsed || parsed.web) return null;
  return `${parsed.tirada}-${parsed.seq}`;
};

export const getActivatedSlotsByTirada = (mascotas) => {
  const byTirada = new Map();
  for (const mascota of mascotas) {
    const parsed = parseChapitaTirada(mascota.id);
    if (!parsed || parsed.web) continue;
    if (!byTirada.has(parsed.tirada)) {
      byTirada.set(parsed.tirada, new Set());
    }
    byTirada.get(parsed.tirada).add(parsed.seq);
  }
  return byTirada;
};

function resolveTiradaCapacidad(cantidad) {
  const n = Number(cantidad);
  if (!Number.isFinite(n)) return CHAPITAS_PER_TIRADA;
  return Math.min(CHAPITAS_PER_TIRADA, Math.max(1, Math.round(n)));
}

export const countActivatedInTirada = (mascotas, tirada, cantidad = CHAPITAS_PER_TIRADA) => {
  const slots = getActivatedSlotsByTirada(mascotas).get(tirada);
  if (!slots?.size) return 0;
  const cap = resolveTiradaCapacidad(cantidad);
  if (cap >= CHAPITAS_PER_TIRADA) return slots.size;
  let count = 0;
  for (const seq of slots) {
    if (seq >= 1 && seq <= cap) count += 1;
  }
  return count;
};

export const countAvailableInTirada = (mascotas, tirada, cantidad = CHAPITAS_PER_TIRADA) => {
  const cap = resolveTiradaCapacidad(cantidad);
  return Math.max(0, cap - countActivatedInTirada(mascotas, tirada, cap));
};

export const countAvailableAllTiradas = (mascotas, tiradaActual, cantidadesByTirada) => {
  let total = 0;
  for (let t = 1; t <= tiradaActual; t += 1) {
    const cantidad = cantidadesByTirada?.[t] ?? cantidadesByTirada?.[String(t)];
    total += countAvailableInTirada(mascotas, t, cantidad);
  }
  return total;
};

export const countActivatedAllTiradas = (mascotas, tiradaActual, cantidadesByTirada) => {
  let total = 0;
  for (let t = 1; t <= tiradaActual; t += 1) {
    const cantidad = cantidadesByTirada?.[t] ?? cantidadesByTirada?.[String(t)];
    total += countActivatedInTirada(mascotas, t, cantidad);
  }
  return total;
};

export const isFirstTiradaFreeActivation = (id) => {
  const parsed = parseChapitaTirada(id);
  return Boolean(parsed && !parsed.web && parsed.tirada === 1);
};

/** @deprecated */
export const generateChapitaId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(randomValues, (value) => chars[value % chars.length]).join('');
};

export const isValidChapitaId = (id) =>
  isTiradaChapitaId(id) || isDynamicChapitaId(String(id).trim().toLowerCase());

export const extractChapitaIdFromRoute = (raw) => {
  if (raw == null || raw === '') return null;
  let decoded = String(raw).trim().replace(/\/+$/, '');
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // mantener valor original
  }

  const splitTirada = /^([Tt]\d+)\/(\d{1,3})$/.exec(decoded);
  if (splitTirada) {
    const tirada = parseInt(splitTirada[1].slice(1), 10);
    const seq = parseInt(splitTirada[2], 10);
    return formatTiradaChapitaId(tirada, seq);
  }

  return decoded;
};

export const getCanonicalInsertChapitaId = (id) => {
  const routeId = extractChapitaIdFromRoute(id);
  return normalizeChapitaId(routeId ?? id);
};

export const getChapitaAppPath = (id) => `/mascota/${encodeURIComponent(id)}`;

export const getChapitaPublicUrl = (id) => {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}${getChapitaAppPath(id)}`;
};

export const getChapitaLookupIds = (id) => {
  const normalized = normalizeChapitaId(id);
  if (!normalized) return [];
  const ids = new Set([normalized]);
  const parsed = parseChapitaTirada(normalized);
  if (parsed && !parsed.web && parsed.tirada === 1) {
    ids.add(String(parsed.seq).padStart(3, '0'));
    ids.add(formatTiradaChapitaId(1, parsed.seq));
  }
  return [...ids];
};

export const formatChapitaIdLabel = (id) => {
  const parsed = parseChapitaTirada(id);
  if (!parsed || parsed.web) return String(id);
  if (parsed.legacy) {
    return `T1-${String(parsed.seq).padStart(3, '0')} (${String(parsed.seq).padStart(3, '0')})`;
  }
  return formatTiradaChapitaId(parsed.tirada, parsed.seq);
};
