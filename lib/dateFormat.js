/** Formato unificado de fechas en toda la app: DD/MM/YYYY */

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Interpreta fechas ISO / date-only sin corrimiento de día por zona horaria.
 * @param {string|number|Date|null|undefined} value
 * @returns {Date|null}
 */
export function parseAppDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // YYYY-MM-DD (o prefijo de un ISO)
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.slice(0, 10));
  if (dateOnly && (raw.length === 10 || raw[10] === "T" || raw[10] === " ")) {
    const y = Number(dateOnly[1]);
    const m = Number(dateOnly[2]);
    const d = Number(dateOnly[3]);
    const local = new Date(y, m - 1, d, 12, 0, 0, 0);
    if (
      local.getFullYear() === y &&
      local.getMonth() === m - 1 &&
      local.getDate() === d
    ) {
      // Si trae hora (ISO completo), preferimos el instante real
      if (raw.length > 10 && /T|\s\d{2}:/.test(raw)) {
        const full = new Date(raw);
        if (!Number.isNaN(full.getTime())) return full;
      }
      return local;
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** DD/MM/YYYY */
export function formatDate(value, empty = "—") {
  if (value == null || value === "") return empty;
  const date = parseAppDate(value);
  if (!date) return String(value);
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** DD/MM/YYYY HH:mm */
export function formatDateTime(value, empty = "—") {
  if (value == null || value === "") return empty;
  const date = parseAppDate(value);
  if (!date) return String(value);
  return `${formatDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** HH:mm */
export function formatTime(value, empty = "") {
  if (value == null || value === "") return empty;
  if (typeof value === "string" && /^\d{1,2}:\d{2}/.test(value) && !value.includes("T")) {
    return value.slice(0, 5);
  }
  const date = parseAppDate(value);
  if (!date) return String(value).slice(0, 5);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
