const LEGACY_ID_PATTERN = /^(0[0-9]{2}|100)$/;
const DYNAMIC_ID_PATTERN = /^[a-z0-9]{8}$/;
const TIRADA_T_ID_PATTERN = /^[Tt](\d+)-(\d{1,3})$/;
const NUMERIC_RANGE_PATTERN = /^\d{3,4}$/;

export const CHAPITAS_PER_TIRADA = 100;
export const MAX_TIRADAS = 99;

export const isLegacyChapitaId = (id) => LEGACY_ID_PATTERN.test(String(id).trim());

export const isDynamicChapitaId = (id) => DYNAMIC_ID_PATTERN.test(String(id).trim().toLowerCase());

/**
 * Tirada 1: T1-001 … T1-100 (compatibilidad con QR ya impresos).
 * Tirada N≥2: N00 … N99 (ej. tirada 2 → 200-299, tirada 3 → 300-399).
 */
export const formatTiradaChapitaId = (tirada, seq) => {
  if (tirada === 1) {
    return `T1-${String(seq).padStart(3, '0')}`;
  }
  return String(tirada * 100 + (seq - 1));
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
    const tirada = Math.floor(num / 100);
    const seq = (num % 100) + 1;
    if (tirada < 1 || tirada > MAX_TIRADAS || seq < 1 || seq > CHAPITAS_PER_TIRADA) {
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

export const countActivatedInTirada = (mascotas, tirada) =>
  getActivatedSlotsByTirada(mascotas).get(tirada)?.size ?? 0;

export const countAvailableInTirada = (mascotas, tirada) =>
  Math.max(0, CHAPITAS_PER_TIRADA - countActivatedInTirada(mascotas, tirada));

export const countAvailableAllTiradas = (mascotas, tiradaActual) => {
  let total = 0;
  for (let t = 1; t <= tiradaActual; t += 1) {
    total += countAvailableInTirada(mascotas, t);
  }
  return total;
};

export const countActivatedAllTiradas = (mascotas, tiradaActual) => {
  let total = 0;
  for (let t = 1; t <= tiradaActual; t += 1) {
    total += countActivatedInTirada(mascotas, t);
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
