function parseTimeToMinutes(value) {
  const raw = String(value || "").slice(0, 5);
  const [h, m] = raw.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Todos los turnos de 30 min cubiertos por horarios (sin mirar ocupación). */
export function generarSlotsDeHorario(horarios, fechaISO, slotMinutos = 30) {
  const date = new Date(`${fechaISO}T12:00:00`);
  if (Number.isNaN(date.getTime())) return [];
  const dia = date.getDay();
  const ranges = (horarios || []).filter(
    (h) => Number(h.dia_semana) === dia && h.activo !== false,
  );
  const slots = [];
  for (const range of ranges) {
    let cursor = parseTimeToMinutes(range.hora_inicio);
    const end = parseTimeToMinutes(range.hora_fin);
    while (cursor + slotMinutos <= end) {
      slots.push(minutesToTime(cursor));
      cursor += slotMinutos;
    }
  }
  return [...new Set(slots)].sort();
}

/** Genera turnos de 30 min libres dentro de los horarios. */
export function generarSlotsDisponibles(horarios, fechaISO, citasOcupadas = [], slotMinutos = 30) {
  const ocupados = new Set(
    (citasOcupadas || [])
      .filter((c) => c.inicio && !["cancelada", "no_asistio"].includes(c.estado))
      .map((c) => {
        const d = new Date(c.inicio);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }),
  );
  return generarSlotsDeHorario(horarios, fechaISO, slotMinutos).filter(
    (label) => !ocupados.has(label),
  );
}

/** Horario de apertura/cierre del local (sin veterinario asignado). */
export function horariosAperturaClinica(horarios) {
  return (horarios || []).filter((h) => !h.veterinario_id && h.activo !== false);
}

/** Agenda propia del veterinario (sin fallback al local). */
export function horariosPropiosVeterinario(horarios, veterinarioId) {
  if (!veterinarioId) return [];
  return (horarios || []).filter(
    (h) => h.veterinario_id === veterinarioId && h.activo !== false,
  );
}

/**
 * Horarios usados para turnos del veterinario.
 * Si el local tiene apertura, el turno debe caer en ambos.
 * Compat: si el vet no tiene agenda propia y solo hay horario de local, usa el local.
 */
export function horariosDeVeterinario(horarios, veterinarioId) {
  const all = horarios || [];
  if (!veterinarioId) return horariosAperturaClinica(all);
  const propios = horariosPropiosVeterinario(all, veterinarioId);
  if (propios.length > 0) return propios;
  return horariosAperturaClinica(all);
}

/** Slots del vet recortados por apertura del local (si existe). */
export function slotsVeterinarioEnClinica(horariosAll, fechaISO, veterinarioId, slotMinutos = 30) {
  const apertura = horariosAperturaClinica(horariosAll);
  const propios = horariosPropiosVeterinario(horariosAll, veterinarioId);
  const base = propios.length ? propios : apertura;
  let slots = generarSlotsDeHorario(base, fechaISO, slotMinutos);
  if (propios.length && apertura.length) {
    const abiertos = new Set(generarSlotsDeHorario(apertura, fechaISO, slotMinutos));
    if (abiertos.size === 0) return [];
    slots = slots.filter((s) => abiertos.has(s));
  }
  return slots;
}

export function fechaHoraLocalDesdeValor(value) {
  if (!value) return { fechaISO: "", hora: "" };
  if (typeof value === "string" && value.includes("T") && !value.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(value)) {
    const [datePart, timePart = "00:00"] = value.split("T");
    return { fechaISO: datePart, hora: timePart.slice(0, 5) };
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return { fechaISO: "", hora: "" };
  const pad = (n) => String(n).padStart(2, "0");
  return {
    fechaISO: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
