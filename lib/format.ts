export function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseWeight(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100) / 100;
}

export function initials(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return letters || "·";
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatDate(value: string | null) {
  if (!value) return "Sin registro";
  const date = parseDateOnly(value);
  if (!date) return value;

  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(date);
}

export function formatAge(birthDate: string | null) {
  if (!birthDate) return "Edad no registrada";
  const birth = parseDateOnly(birthDate);
  if (!birth) return "Edad no registrada";

  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());

  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return "Edad no registrada";
  if (months < 1) return "Menos de un mes";
  if (months < 12) return months === 1 ? "1 mes" : `${months} meses`;

  const years = Math.floor(months / 12);
  const remainder = months % 12;
  const yearLabel = years === 1 ? "1 año" : `${years} años`;
  if (remainder === 0) return yearLabel;

  const monthLabel = remainder === 1 ? "1 mes" : `${remainder} meses`;
  return `${yearLabel} y ${monthLabel}`;
}

export function formatWeight(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "Sin registro";

  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return "Sin registro";

  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(number);

  return `${formatted} kg`;
}

export function formatVisit(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
