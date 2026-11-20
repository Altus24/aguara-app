import {
  fechaHoraLocalDesdeValor,
  generarSlotsDisponibles,
  horariosAperturaClinica,
  horariosPropiosVeterinario,
  slotsVeterinarioEnClinica,
} from "@/lib/chapitas/agendaSlots";
import { listarHorarios } from "@/lib/chapitas/clinicas";
import { supabase } from "@/lib/chapitas/supabaseClient";

function startOfDayLocalISO(fechaISO) {
  const d = new Date(`${fechaISO}T00:00:00`);
  return d.toISOString();
}

function endOfDayLocalISO(fechaISO) {
  const d = new Date(`${fechaISO}T23:59:59.999`);
  return d.toISOString();
}

export async function listarDisponibilidadVeterinario({
  clinicaId,
  veterinarioId,
  fechaISO,
  citaIdExcluir,
}) {
  if (!clinicaId || !fechaISO) {
    return {
      horarios: [],
      citas: [],
      slotsDia: [],
      slotsLibres: [],
      apertura: [],
      clinicaCerrada: false,
      sinHorarioVet: false,
    };
  }

  const [horariosAll, citasRes] = await Promise.all([
    listarHorarios(clinicaId),
    supabase
      .from("clinica_citas")
      .select("id, inicio, fin, estado, veterinario_id")
      .eq("clinica_id", clinicaId)
      .neq("estado", "lista_espera")
      .gte("inicio", startOfDayLocalISO(fechaISO))
      .lte("inicio", endOfDayLocalISO(fechaISO))
      .order("inicio"),
  ]);

  if (citasRes.error) {
    throw new Error(citasRes.error.message || "No se pudieron cargar las citas del día.");
  }

  const apertura = horariosAperturaClinica(horariosAll);
  const propios = veterinarioId
    ? horariosPropiosVeterinario(horariosAll, veterinarioId)
    : [];
  const horarios = veterinarioId
    ? propios.length
      ? propios
      : apertura
    : apertura;

  const citas = (citasRes.data || []).filter((c) => {
    if (citaIdExcluir && c.id === citaIdExcluir) return false;
    if (!veterinarioId) return true;
    return !c.veterinario_id || c.veterinario_id === veterinarioId;
  });

  const slotsDia = veterinarioId
    ? slotsVeterinarioEnClinica(horariosAll, fechaISO, veterinarioId)
    : generarSlotsFromApertura(apertura, fechaISO);

  const ocupados = new Set(
    citas
      .filter((c) => c.inicio && !["cancelada", "no_asistio"].includes(c.estado))
      .map((c) => {
        const d = new Date(c.inicio);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }),
  );
  const slotsLibres = slotsDia.filter((s) => !ocupados.has(s));

  const clinicaCerrada =
    apertura.length > 0 &&
    slotsVeterinarioEnClinica(
      [...apertura.map((h) => ({ ...h, veterinario_id: null })), ...propios],
      fechaISO,
      veterinarioId || "x",
    ).length === 0 &&
    generarSlotsFromApertura(apertura, fechaISO).length === 0;

  return {
    horarios,
    citas,
    slotsDia,
    slotsLibres,
    apertura,
    clinicaCerrada: Boolean(apertura.length) && generarSlotsFromApertura(apertura, fechaISO).length === 0,
    sinHorarioVet: Boolean(veterinarioId) && propios.length === 0 && apertura.length === 0,
  };
}

function generarSlotsFromApertura(apertura, fechaISO) {
  // Reuse generarSlotsDisponibles with empty citas via slots from apertura ranges
  return generarSlotsDisponibles(apertura, fechaISO, [], 30);
}

/**
 * Valida que el veterinario atienda ese día, dentro de la apertura del local, y libre.
 */
export async function validarDisponibilidadVeterinario({
  clinicaId,
  veterinarioId,
  inicio,
  citaIdExcluir,
  requerirVeterinario = true,
}) {
  if (requerirVeterinario && !veterinarioId) {
    throw new Error("Elegí un veterinario para la cita.");
  }
  if (!inicio) {
    throw new Error("Indicá fecha y hora de inicio.");
  }

  const { fechaISO, hora } = fechaHoraLocalDesdeValor(inicio);
  if (!fechaISO || !hora) {
    throw new Error("Fecha/hora de inicio inválida.");
  }

  if (!veterinarioId) {
    return { fechaISO, hora, slotsLibres: [] };
  }

  const { horarios, slotsDia, slotsLibres, apertura, clinicaCerrada, sinHorarioVet } =
    await listarDisponibilidadVeterinario({
      clinicaId,
      veterinarioId,
      fechaISO,
      citaIdExcluir,
    });

  if (sinHorarioVet) {
    throw new Error(
      "Ese veterinario no tiene horarios cargados. Agregalos en su perfil (Configuración → Veterinarios).",
    );
  }

  if (clinicaCerrada) {
    throw new Error("La clínica está cerrada ese día. Revisá el horario de apertura del local.");
  }

  if (apertura.length && !generarSlotsFromApertura(apertura, fechaISO).includes(hora) && slotsDia.length) {
    // hora outside clinic open even if somehow in slotsDia - covered by slotsDia intersection
  }

  if (!horarios.length && !apertura.length) {
    throw new Error(
      "No hay horarios configurados. Cargá la apertura del local y la agenda del veterinario.",
    );
  }

  if (!slotsDia.length) {
    if (apertura.length && generarSlotsFromApertura(apertura, fechaISO).length === 0) {
      throw new Error("La clínica está cerrada ese día.");
    }
    throw new Error("El veterinario no atiende ese día (o está fuera del horario de apertura).");
  }

  if (!slotsDia.includes(hora)) {
    throw new Error(
      `Ese horario no está disponible. Turnos válidos: ${slotsDia.join(", ")}.`,
    );
  }

  if (!slotsLibres.includes(hora)) {
    throw new Error("Ese horario ya está ocupado para el veterinario.");
  }

  return { fechaISO, hora, slotsLibres, slotsDia };
}
