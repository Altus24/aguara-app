export const fieldClass =
  "w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-aguara-ink outline-none focus:border-aguara-orange focus:ring-4 focus:ring-aguara-orange/15";

export const cardClass = "rounded-2xl border border-stone-200 bg-white p-5 sm:p-6";

export const primaryBtnClass =
  "inline-flex h-10 items-center justify-center rounded-full bg-aguara-orange px-4 text-sm font-medium text-white hover:bg-aguara-orange-deep disabled:opacity-60";

export const secondaryBtnClass =
  "inline-flex h-10 items-center justify-center rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 hover:border-stone-400 disabled:opacity-60";

export function Field({ label, id, children, className = "" }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-stone-800">
        {label}
      </label>
      {children}
    </div>
  );
}

export function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

export function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value + (String(value).length <= 10 ? "T12:00:00" : "")).toLocaleDateString(
      "es-AR",
    );
  } catch {
    return String(value);
  }
}

export function formatTime(value) {
  if (!value) return "";
  if (typeof value === "string" && value.includes("T")) {
    return new Date(value).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }
  return String(value).slice(0, 5);
}

export const ESTADO_COLORS = {
  pendiente: "bg-yellow-100 text-yellow-900",
  confirmada: "bg-sky-100 text-sky-800",
  en_espera: "bg-amber-100 text-amber-900",
  en_atencion: "bg-violet-100 text-violet-900",
  finalizada: "bg-emerald-100 text-emerald-900",
  no_asistio: "bg-stone-200 text-stone-700",
  cancelada: "bg-red-100 text-red-800",
  lista_espera: "bg-orange-100 text-orange-900",
};

export function EstadoBadge({ estado, label }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_COLORS[estado] || "bg-stone-100 text-stone-700"}`}
    >
      {label || estado}
    </span>
  );
}
