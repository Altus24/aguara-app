"use client";

/** Normaliza lista de horarios HH:MM. */
export function normalizeHorarios(list) {
  return (Array.isArray(list) ? list : [])
    .map((h) => String(h || "").trim().slice(0, 5))
    .filter((h) => /^\d{2}:\d{2}$/.test(h));
}

export function formatHorariosLabel(list) {
  const h = normalizeHorarios(list);
  return h.length ? h.join(" · ") : "";
}

export function emptyMedicacionExtras() {
  return {
    horarios: [""],
    de_por_vida: false,
    fecha_fin: "",
  };
}

/**
 * Campos compartidos: horarios de toma + opción de por vida (+ fecha fin).
 */
export default function MedicacionExtrasFields({
  horarios = [""],
  onHorariosChange,
  dePorVida = false,
  onDePorVidaChange,
  fechaFin = "",
  onFechaFinChange,
  fieldClass,
  showDePorVida = true,
  showFechaFin = true,
  fechaFinLabel = "Hasta / próxima fecha",
}) {
  const rows = horarios?.length ? horarios : [""];

  function setAt(index, value) {
    const next = rows.map((h, i) => (i === index ? value : h));
    onHorariosChange?.(next);
  }

  function addRow() {
    onHorariosChange?.([...rows, ""]);
  }

  function removeRow(index) {
    if (rows.length <= 1) {
      onHorariosChange?.([""]);
      return;
    }
    onHorariosChange?.(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="mb-1 text-xs font-medium text-stone-600">Horarios de toma</p>
        <div className="space-y-2">
          {rows.map((hora, index) => (
            <div key={`hora-${index}`} className="flex items-center gap-2">
              <input
                type="time"
                className={fieldClass}
                value={hora}
                onChange={(e) => setAt(index, e.target.value)}
                aria-label={`Horario ${index + 1}`}
              />
              <button
                type="button"
                className="shrink-0 text-xs text-stone-500 underline"
                onClick={() => removeRow(index)}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-2 text-sm font-medium text-aguara-orange hover:underline"
          onClick={addRow}
        >
          + Agregar horario
        </button>
      </div>

      {showDePorVida ? (
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={Boolean(dePorVida)}
            onChange={(e) => onDePorVidaChange?.(e.target.checked)}
          />
          De por vida
        </label>
      ) : null}

      {showFechaFin && !dePorVida ? (
        <label className="block text-xs text-stone-500">
          {fechaFinLabel}
          <input
            type="date"
            className={`${fieldClass} mt-1`}
            value={fechaFin || ""}
            onChange={(e) => onFechaFinChange?.(e.target.value)}
          />
        </label>
      ) : null}
    </div>
  );
}
