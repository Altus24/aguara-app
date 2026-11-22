import { supabase } from "@/lib/chapitas/supabaseClient";
import {
  endOfDayISO,
  esCitaPasada,
  etiquetaEstado,
  etiquetaEstadoCitaTutor,
  listarCitasRango,
  listarVeterinarios,
  startOfDayISO,
} from "@/lib/chapitas/clinicaOps";
import {
  generarSlotsDeHorario,
  generarSlotsDisponibles,
  horariosDeVeterinario,
  slotsVeterinarioEnClinica,
} from "@/lib/chapitas/agendaSlots";
import { validarDisponibilidadVeterinario } from "@/lib/chapitas/agendaDisponibilidad";
import { listarHorarios } from "@/lib/chapitas/clinicas";
import { componerDireccion } from "@/lib/chapitas/tutorPerfilPrefs";
import { formatDate, formatDateTime } from "@/lib/dateFormat";

const TUTOR_SELECT =
  "id, nombre_completo, email, telefono, telefono_secundario, direccion, clinica_preferida_id, calle, numeracion, tipo_vivienda, piso_depto, localidad, provincia, maps_url, notif_push_mobile, recordatorio_anticipacion, recordatorio_canales";

const TUTOR_SELECT_LEGACY =
  "id, nombre_completo, email, telefono, telefono_secundario, direccion, clinica_preferida_id";

export {
  generarSlotsDeHorario,
  generarSlotsDisponibles,
  horariosDeVeterinario,
  horariosAperturaClinica,
  horariosPropiosVeterinario,
  slotsVeterinarioEnClinica,
} from "@/lib/chapitas/agendaSlots";

function missing(error, label = "portal tutor") {
  if (/tutores|clinica_|mascotas|schema cache|does not exist/i.test(error?.message || "")) {
    return new Error(
      `Falta esquema (${label}). Ejecutá supabase/chapitas/13_tutor_portal.sql en Supabase.`,
    );
  }
  return null;
}

async function run(query, label) {
  const { data, error } = await query;
  if (error) throw missing(error, label) || new Error(error.message);
  return data;
}

export function calcEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const born = new Date(`${fechaNacimiento}T12:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  let months = now.getMonth() - born.getMonth();
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years <= 0) return months <= 0 ? "Recién nacido" : `${months} mes${months === 1 ? "" : "es"}`;
  if (months === 0) return `${years} año${years === 1 ? "" : "s"}`;
  return `${years} año${years === 1 ? "" : "s"} ${months} mes${months === 1 ? "" : "es"}`;
}

export { etiquetaEstado, etiquetaEstadoCitaTutor, esCitaPasada };

/* ---------- Perfil ---------- */
export async function obtenerTutor(id) {
  const { data, error } = await supabase
    .from("tutores")
    .select(TUTOR_SELECT)
    .eq("id", id)
    .single();
  if (!error) return data;
  if (/calle|maps_url|recordatorio_|notif_push|schema cache|does not exist/i.test(error.message || "")) {
    return run(
      supabase.from("tutores").select(TUTOR_SELECT_LEGACY).eq("id", id).single(),
      "tutores",
    );
  }
  throw missing(error, "tutores") || new Error(error.message);
}

export async function actualizarTutor(id, payload) {
  const direccion = payload.direccion?.trim() || componerDireccion(payload) || null;
  const full = {
    nombre_completo: payload.nombre_completo.trim(),
    telefono: payload.telefono.trim(),
    telefono_secundario: payload.telefono_secundario?.trim() || null,
    direccion,
    clinica_preferida_id: payload.clinica_preferida_id || null,
    calle: payload.calle?.trim() || null,
    numeracion: payload.numeracion?.trim() || null,
    tipo_vivienda: payload.tipo_vivienda || null,
    piso_depto: payload.piso_depto?.trim() || null,
    localidad: payload.localidad?.trim() || null,
    provincia: payload.provincia?.trim() || null,
    maps_url: payload.maps_url?.trim() || null,
    notif_push_mobile: Boolean(payload.notif_push_mobile),
    recordatorio_anticipacion: Array.isArray(payload.recordatorio_anticipacion)
      ? payload.recordatorio_anticipacion
      : [],
    recordatorio_canales: Array.isArray(payload.recordatorio_canales)
      ? payload.recordatorio_canales
      : ["app"],
  };

  const { data, error } = await supabase
    .from("tutores")
    .update(full)
    .eq("id", id)
    .select(TUTOR_SELECT)
    .single();

  if (!error) return data;

  if (/calle|maps_url|recordatorio_|notif_push|schema cache|does not exist/i.test(error.message || "")) {
    throw new Error(
      "Falta esquema de perfil ampliado. Ejecutá supabase/chapitas/36_tutor_perfil_ubicacion_notif.sql.",
    );
  }
  throw missing(error, "tutores") || new Error(error.message);
}

export async function listarClinicas() {
  const withFlag = await supabase
    .from("clinicas")
    .select("id, nombre, ciudad, direccion, telefono, permite_citas_tutor")
    .order("nombre");
  if (!withFlag.error) return withFlag.data ?? [];

  // Compat: si aún no corrieron 13_tutor_portal.sql
  return (
    (await run(
      supabase
        .from("clinicas")
        .select("id, nombre, ciudad, direccion, telefono")
        .order("nombre"),
      "clinicas",
    )) ?? []
  ).map((c) => ({ ...c, permite_citas_tutor: true }));
}

export async function listarClinicasParaTurnos() {
  const all = await listarClinicas();
  return all.filter((c) => c.permite_citas_tutor !== false);
}

/** Valor especial del select de veterinario en el portal tutor. */
export const VET_SEGUN_DISPONIBILIDAD = "__segun_disponibilidad__";

export async function listarVeterinariosParaTurnos(clinicaId) {
  const vets = await listarVeterinarios(clinicaId);
  return vets.filter((v) => v.activo !== false);
}

export async function listarHorariosYOcupacion(
  clinicaId,
  fechaISO,
  veterinarioId,
  { citaIdExcluir } = {},
) {
  const day = new Date(`${fechaISO}T12:00:00`);
  const [horariosAll, citasAll] = await Promise.all([
    listarHorarios(clinicaId),
    listarCitasRango(clinicaId, startOfDayISO(day), endOfDayISO(day)),
  ]);
  const horarios = veterinarioId
    ? horariosDeVeterinario(horariosAll, veterinarioId)
    : horariosAll.filter((h) => !h.veterinario_id);
  // Solo bloquean el slot las citas del mismo veterinario (u otras sin vet asignado)
  const citas = (veterinarioId
    ? citasAll.filter((c) => !c.veterinario_id || c.veterinario_id === veterinarioId)
    : citasAll
  ).filter((c) => !(citaIdExcluir && c.id === citaIdExcluir));
  const slotsDia = veterinarioId
    ? slotsVeterinarioEnClinica(horariosAll, fechaISO, veterinarioId)
    : generarSlotsDeHorario(horarios, fechaISO);
  const ocupados = new Set(
    (citas || [])
      .filter((c) => c.inicio && !["cancelada", "no_asistio"].includes(c.estado))
      .map((c) => {
        const d = new Date(c.inicio);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }),
  );
  const slots = slotsDia.filter((s) => !ocupados.has(s));
  return {
    horarios,
    citas,
    slotsDia,
    slots,
    sinHorarios: !horarios.length,
    sinAtencionEseDia: Boolean(horarios.length) && slotsDia.length === 0,
    sinLibres: Boolean(slotsDia.length) && slots.length === 0,
  };
}

/**
 * Une los horarios libres de todos los veterinarios activos de la clínica.
 * `porHora[HH:MM]` = ids de vets disponibles en ese slot.
 */
export async function listarSlotsSegunDisponibilidad(
  clinicaId,
  fechaISO,
  { citaIdExcluir } = {},
) {
  const vets = await listarVeterinariosParaTurnos(clinicaId);
  const porHora = {};
  let algunoConAgenda = false;
  await Promise.all(
    vets.map(async (vet) => {
      const data = await listarHorariosYOcupacion(clinicaId, fechaISO, vet.id, {
        citaIdExcluir,
      });
      if (data.horarios?.length) algunoConAgenda = true;
      for (const slot of data.slots) {
        if (!porHora[slot]) porHora[slot] = [];
        porHora[slot].push(vet.id);
      }
    }),
  );
  const slots = Object.keys(porHora).sort();
  return { slots, porHora, vets, algunoConAgenda };
}

export async function asegurarClienteTutorEnClinica(tutor, clinicaId) {
  const existentes = await listarClientesDelTutor(tutor.id, tutor.email);
  const found = existentes.find((c) => c.clinica_id === clinicaId);
  if (found) return found;

  return run(
    supabase
      .from("clinica_clientes")
      .insert({
        clinica_id: clinicaId,
        tutor_id: tutor.id,
        nombre_completo: tutor.nombre_completo,
        email: tutor.email,
        telefono: tutor.telefono || "",
        telefono_secundario: tutor.telefono_secundario || null,
        direccion: tutor.direccion || null,
      })
      .select("id, clinica_id, nombre_completo, email, telefono, tutor_id")
      .single(),
    "clientes",
  );
}

export async function asegurarPacienteEnClinica({
  clinicaId,
  clienteId,
  mascota,
}) {
  if (mascota?.paciente_clinico_id && mascota?.clinica_id === clinicaId) {
    return { id: mascota.paciente_clinico_id, cliente_id: clienteId };
  }

  let query = supabase
    .from("clinica_pacientes")
    .select("id, cliente_id, clinica_id, activo")
    .eq("clinica_id", clinicaId)
    .limit(1);

  if (mascota?.chapita_id) {
    query = query.or(
      `mascota_chapita_id.eq.${mascota.chapita_id},chapita_codigo.eq.${mascota.chapita_id}`,
    );
  } else if (mascota?.nombre) {
    query = query.eq("nombre", mascota.nombre).eq("cliente_id", clienteId);
  }

  const { data: existingRows, error: existingError } = await query;
  if (existingError) {
    throw missing(existingError, "pacientes") || new Error(existingError.message);
  }
  if (existingRows?.[0]) {
    const existing = existingRows[0];
    if (existing.activo === false) {
      return run(
        supabase
          .from("clinica_pacientes")
          .update({
            activo: true,
            cliente_id: clienteId,
            nombre: mascota.nombre || undefined,
            especie: mascota.especie || undefined,
            raza: mascota.raza || null,
            sexo: mascota.sexo || null,
            fecha_nacimiento: mascota.fecha_nacimiento || null,
            foto_url: mascota.foto_url || null,
            chapita_codigo: mascota.chapita_id || null,
            mascota_chapita_id: mascota.chapita_id || null,
          })
          .eq("id", existing.id)
          .select("id, cliente_id, clinica_id")
          .single(),
        "pacientes",
      );
    }
    return existing;
  }

  const insertPayload = {
    clinica_id: clinicaId,
    cliente_id: clienteId,
    nombre: mascota.nombre,
    especie: mascota.especie || "Canino",
    raza: mascota.raza || null,
    sexo: mascota.sexo || null,
    fecha_nacimiento: mascota.fecha_nacimiento || null,
    foto_url: mascota.foto_url || null,
    chapita_codigo: mascota.chapita_id || null,
    mascota_chapita_id: mascota.chapita_id || null,
    chip: mascota.chip || null,
    enfermedad: mascota.enfermedad || null,
    alergias: mascota.alergias || null,
    temperamento: mascota.temperamento || null,
    castrado:
      mascota.castrado === true || mascota.castrado === false
        ? mascota.castrado
        : null,
    activo: true,
  };

  let { data, error } = await supabase
    .from("clinica_pacientes")
    .insert(insertPayload)
    .select("id, cliente_id, clinica_id")
    .single();

  if (error && /enfermedad|schema cache|does not exist/i.test(error.message || "")) {
    if (insertPayload.enfermedad) {
      insertPayload.notas = `Enfermedad: ${insertPayload.enfermedad}`;
    }
    delete insertPayload.enfermedad;
    ({ data, error } = await supabase
      .from("clinica_pacientes")
      .insert(insertPayload)
      .select("id, cliente_id, clinica_id")
      .single());
  }

  if (error && /temperamento|castrado|schema cache|does not exist/i.test(error.message || "")) {
    delete insertPayload.temperamento;
    delete insertPayload.castrado;
    ({ data, error } = await supabase
      .from("clinica_pacientes")
      .insert(insertPayload)
      .select("id, cliente_id, clinica_id")
      .single());
  }

  if (error) {
    throw missing(error, "pacientes") || new Error(error.message);
  }
  return data;
}

/** Tras aceptar compartir, da de alta la mascota como paciente de la clínica. */
export async function sincronizarMascotaCompartidaEnClinica({
  clinicaId,
  tutorId,
  mascotaId,
}) {
  if (!clinicaId || !tutorId || !mascotaId) return null;

  const tutor = await obtenerTutor(tutorId);
  if (!tutor) throw new Error("No se encontró el tutor.");

  const { data: mascotaRow, error: mascotaError } = await supabase
    .from("mascotas")
    .select(
      "id, nombre_mascota, especie, raza, sexo, castrado, temperamento, fecha_nacimiento, foto_url, tutor_id, nro_chip, enfermedad",
    )
    .eq("id", mascotaId)
    .eq("tutor_id", tutorId)
    .maybeSingle();
  if (mascotaError) {
    throw missing(mascotaError, "mascotas") || new Error(mascotaError.message);
  }
  if (!mascotaRow) throw new Error("No se encontró la mascota a compartir.");

  const cliente = await asegurarClienteTutorEnClinica(tutor, clinicaId);
  // Alta del paciente en la clínica receptora. La HC de otras clínicas
  // (misma chapita) queda visible vía listarConsultas / listar*Completas.
  return asegurarPacienteEnClinica({
    clinicaId,
    clienteId: cliente.id,
    mascota: {
      chapita_id: mascotaRow.id,
      nombre: mascotaRow.nombre_mascota,
      especie: mascotaRow.especie,
      raza: mascotaRow.raza,
      sexo: mascotaRow.sexo,
      fecha_nacimiento: mascotaRow.fecha_nacimiento,
      foto_url: mascotaRow.foto_url,
      temperamento: mascotaRow.temperamento,
      castrado: mascotaRow.castrado,
      chip: mascotaRow.nro_chip,
      enfermedad: mascotaRow.enfermedad || null,
      alergias: null,
    },
  });
}

export async function notificarClinicaTurnoPendiente({
  clinicaId,
  citaId,
  tutorNombre,
  mascotaNombre,
  inicioISO,
}) {
  const cuando = inicioISO ? formatDateTime(inicioISO) : "sin horario";
  const { error } = await supabase.from("clinica_notificaciones").insert({
    clinica_id: clinicaId,
    tipo: "cita_pendiente",
    titulo: "Nuevo turno pendiente",
    mensaje: `${tutorNombre} pidió turno para ${mascotaNombre || "una mascota"} · ${cuando}`,
    cita_id: citaId,
    leida: false,
  });
  // Si falta la tabla 16, no bloqueamos el turno.
  if (error && !/clinica_notificaciones|schema cache|does not exist/i.test(error.message)) {
    console.error(error);
  }
}

export async function solicitarTurnoTutor({
  tutor,
  clinicaId,
  veterinarioId,
  mascota,
  fecha,
  hora,
  motivo,
  notas,
  citaId,
  segunDisponibilidad = false,
}) {
  if (!clinicaId) throw new Error("Elegí una clínica.");
  if (!mascota) throw new Error("Elegí una mascota.");
  if (!fecha || !hora) throw new Error("Elegí fecha y horario disponible.");

  let vetId = veterinarioId;
  if (segunDisponibilidad || vetId === VET_SEGUN_DISPONIBILIDAD || !vetId) {
    const { porHora } = await listarSlotsSegunDisponibilidad(clinicaId, fecha, {
      citaIdExcluir: citaId || null,
    });
    const candidatos = porHora[hora] || [];
    if (!candidatos.length) {
      throw new Error(
        "Ese horario no está disponible según la agenda de los veterinarios. Elegí otra fecha u horario.",
      );
    }
    vetId = candidatos[0];
  }
  if (!vetId) throw new Error("Elegí un veterinario.");

  const inicioLocal = new Date(`${fecha}T${hora}:00`);
  if (Number.isNaN(inicioLocal.getTime())) throw new Error("Fecha/hora inválida.");
  const finLocal = new Date(inicioLocal.getTime() + 30 * 60 * 1000);
  const inicioISO = inicioLocal.toISOString();
  const finISO = finLocal.toISOString();

  // Misma validación que clínica: agenda del vet ∩ apertura + slot libre
  await validarDisponibilidadVeterinario({
    clinicaId,
    veterinarioId: vetId,
    inicio: `${fecha}T${hora}:00`,
    citaIdExcluir: citaId || null,
    requerirVeterinario: true,
  });

  const cliente = await asegurarClienteTutorEnClinica(tutor, clinicaId);
  const paciente = await asegurarPacienteEnClinica({
    clinicaId,
    clienteId: cliente.id,
    mascota,
  });

  let cita;
  if (citaId) {
    cita = await reprogramarCitaTutor(citaId, {
      inicio: inicioISO,
      fin: finISO,
      motivo,
      notas,
      veterinario_id: vetId,
    });
  } else {
    cita = await solicitarCitaTutor({
      clinica_id: clinicaId,
      paciente_id: paciente.id,
      cliente_id: cliente.id,
      veterinario_id: vetId,
      inicio: inicioISO,
      fin: finISO,
      motivo,
      notas,
      estado: "pendiente",
    });
  }

  await notificarClinicaTurnoPendiente({
    clinicaId,
    citaId: cita.id,
    tutorNombre: tutor.nombre_completo,
    mascotaNombre: mascota.nombre,
    inicioISO,
  });

  return cita;
}

/* ---------- Mascotas (chapitas + vínculo clínico) ---------- */
export async function listarMascotasTutorCompletas(tutorId, email) {
  let chapitasQuery = await supabase
    .from("mascotas")
    .select(
      "id, nombre_mascota, especie, raza, foto_url, fecha_nacimiento, sexo, creado_en, tutor_id, clinica_cabecera_id",
    )
    .eq("tutor_id", tutorId)
    .order("creado_en", { ascending: false });

  if (
    chapitasQuery.error &&
    /clinica_cabecera|schema cache|does not exist/i.test(chapitasQuery.error.message || "")
  ) {
    chapitasQuery = await supabase
      .from("mascotas")
      .select(
        "id, nombre_mascota, especie, raza, foto_url, fecha_nacimiento, sexo, creado_en, tutor_id",
      )
      .eq("tutor_id", tutorId)
      .order("creado_en", { ascending: false });
  }

  if (chapitasQuery.error) {
    throw missing(chapitasQuery.error, "mascotas") || new Error(chapitasQuery.error.message);
  }

  const chapitas = (chapitasQuery.data ?? []).map((m) => ({
    ...m,
    clinica_cabecera_id: m.clinica_cabecera_id ?? null,
  }));

  const clientes = await listarClientesDelTutor(tutorId, email);
  const clienteIds = clientes.map((c) => c.id);
  let clinicos = [];
  if (clienteIds.length) {
    clinicos =
      (await run(
        supabase
          .from("clinica_pacientes")
          .select(
            "id, cliente_id, nombre, especie, raza, sexo, fecha_nacimiento, foto_url, chapita_codigo, mascota_chapita_id, clinica_id, activo",
          )
          .in("cliente_id", clienteIds)
          .eq("activo", true)
          .order("nombre"),
        "pacientes",
      )) ?? [];
  }

  const byChapita = new Map(
    clinicos
      .filter((p) => p.mascota_chapita_id || p.chapita_codigo)
      .map((p) => [p.mascota_chapita_id || p.chapita_codigo, p]),
  );

  const merged = chapitas.map((m) => {
    const clinico = byChapita.get(m.id);
    const esDigital = /^DIG-[a-f0-9]{12}$/i.test(String(m.id || ""));
    return {
      key: `chapita-${m.id}`,
      origen: esDigital ? "digital" : "chapita",
      chapita_id: m.id,
      sin_chapita: esDigital,
      paciente_clinico_id: clinico?.id || null,
      clinica_id: clinico?.clinica_id || null,
      cliente_id: clinico?.cliente_id || null,
      clinica_cabecera_id: m.clinica_cabecera_id || null,
      nombre: m.nombre_mascota,
      especie: m.especie || clinico?.especie || "Mascota",
      raza: m.raza || clinico?.raza || null,
      foto_url: m.foto_url || clinico?.foto_url || null,
      fecha_nacimiento: m.fecha_nacimiento || clinico?.fecha_nacimiento || null,
      edad: calcEdad(m.fecha_nacimiento || clinico?.fecha_nacimiento),
      sexo: m.sexo || clinico?.sexo || null,
    };
  });

  const linkedChapitas = new Set(merged.map((m) => m.chapita_id).filter(Boolean));
  // Solo enlazamos perfil si la chapita existe en `mascotas`.
  // Tras borrar una tirada pueden quedar pacientes clínicos con código huérfano.
  const orphanCodes = [
    ...new Set(
      clinicos
        .map((p) => p.mascota_chapita_id || p.chapita_codigo)
        .filter((code) => code && !linkedChapitas.has(code)),
    ),
  ];
  let chapitasVivas = new Set();
  if (orphanCodes.length) {
    const vivas =
      (await run(
        supabase.from("mascotas").select("id").in("id", orphanCodes),
        "mascotas",
      )) ?? [];
    chapitasVivas = new Set(vivas.map((m) => m.id));
  }

  for (const p of clinicos) {
    const code = p.mascota_chapita_id || p.chapita_codigo;
    if (code && linkedChapitas.has(code)) continue;
    // Código sin fila en mascotas = huérfano (p. ej. tirada borrada): no mostrar enlace roto.
    if (code && !chapitasVivas.has(code)) continue;
    merged.push({
      key: `clinico-${p.id}`,
      origen: "clinico",
      chapita_id: code && chapitasVivas.has(code) ? code : null,
      paciente_clinico_id: p.id,
      clinica_id: p.clinica_id,
      cliente_id: p.cliente_id,
      nombre: p.nombre,
      especie: p.especie || "Mascota",
      raza: p.raza || null,
      foto_url: p.foto_url || null,
      fecha_nacimiento: p.fecha_nacimiento || null,
      edad: calcEdad(p.fecha_nacimiento),
      sexo: p.sexo || null,
    });
  }

  return { mascotas: merged, clientes };
}

export async function listarClientesDelTutor(tutorId, email) {
  const emailNorm = String(email || "")
    .trim()
    .toLowerCase();
  const byTutor =
    (await run(
      supabase
        .from("clinica_clientes")
        .select("id, clinica_id, nombre_completo, email, telefono, tutor_id")
        .eq("tutor_id", tutorId),
      "clientes",
    )) ?? [];

  let byEmail = [];
  if (emailNorm) {
    byEmail =
      (await run(
        supabase
          .from("clinica_clientes")
          .select("id, clinica_id, nombre_completo, email, telefono, tutor_id")
          .ilike("email", emailNorm),
        "clientes",
      )) ?? [];

    // Soft-link for future queries
    await Promise.all(
      byEmail
        .filter((c) => !c.tutor_id)
        .map((c) =>
          supabase.from("clinica_clientes").update({ tutor_id: tutorId }).eq("id", c.id),
        ),
    );
  }

  const map = new Map();
  for (const c of [...byTutor, ...byEmail]) {
    map.set(c.id, { ...c, tutor_id: c.tutor_id || tutorId });
  }
  return [...map.values()];
}

/* ---------- Citas ---------- */
const CITA_SELECT =
  "id, clinica_id, paciente_id, cliente_id, veterinario_id, inicio, fin, estado, motivo, notas, creado_en, clinica_pacientes(id, nombre), clinicas(id, nombre, ciudad, direccion), clinica_veterinarios(id, nombre)";

export async function listarCitasTutor(tutorId, email) {
  const clientes = await listarClientesDelTutor(tutorId, email);
  const clienteIds = clientes.map((c) => c.id);
  if (!clienteIds.length) return { proximas: [], pasadas: [], clientes };

  const rows =
    (await run(
      supabase
        .from("clinica_citas")
        .select(CITA_SELECT)
        .in("cliente_id", clienteIds)
        .order("inicio", { ascending: true }),
      "citas",
    )) ?? [];

  const ahora = new Date();
  const proximas = [];
  const pasadas = [];
  for (const cita of rows) {
    if (esCitaPasada(cita, { ahora })) {
      pasadas.push(cita);
    } else {
      proximas.push(cita);
    }
  }
  pasadas.sort((a, b) => new Date(b.inicio || 0) - new Date(a.inicio || 0));
  return { proximas, pasadas, clientes };
}

export async function solicitarCitaTutor(payload) {
  return run(
    supabase
      .from("clinica_citas")
      .insert({
        clinica_id: payload.clinica_id,
        paciente_id: payload.paciente_id || null,
        cliente_id: payload.cliente_id || null,
        veterinario_id: payload.veterinario_id || null,
        inicio: payload.inicio || null,
        fin: payload.fin || null,
        estado: payload.estado || "pendiente",
        motivo: payload.motivo?.trim() || "Solicitud del tutor",
        notas: payload.notas?.trim() || null,
      })
      .select(CITA_SELECT)
      .single(),
    "citas",
  );
}

export async function reprogramarCitaTutor(id, { inicio, fin, motivo, notas, veterinario_id }) {
  return run(
    supabase
      .from("clinica_citas")
      .update({
        inicio,
        fin: fin || null,
        motivo: motivo?.trim() || null,
        notas: notas?.trim() || null,
        veterinario_id: veterinario_id || null,
        estado: "pendiente",
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", id)
      .select(CITA_SELECT)
      .single(),
    "citas",
  );
}

export async function cancelarCitaTutor(tutorId, email, citaId) {
  if (!citaId) throw new Error("Cita inválida.");
  const clientes = await listarClientesDelTutor(tutorId, email);
  const clienteIds = clientes.map((c) => c.id);
  if (!clienteIds.length) throw new Error("No se encontró la cita.");

  const { data, error } = await supabase
    .from("clinica_citas")
    .update({
      estado: "cancelada",
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", citaId)
    .in("cliente_id", clienteIds)
    .in("estado", ["pendiente", "confirmada", "lista_espera", "en_espera"])
    .select(CITA_SELECT)
    .maybeSingle();
  if (error) throw missing(error, "citas") || new Error(error.message);
  if (!data) throw new Error("No se pudo cancelar la cita (quizá ya fue cerrada).");

  if (data.clinica_id) {
    const { error: notifError } = await supabase.from("clinica_notificaciones").insert({
      clinica_id: data.clinica_id,
      tipo: "cita_cancelada_tutor",
      titulo: "Turno cancelado por el tutor",
      mensaje: `Se canceló el turno de ${data.clinica_pacientes?.nombre || "una mascota"} · ${
        data.inicio ? formatDateTime(data.inicio) : "sin horario"
      }`,
      cita_id: data.id,
      leida: false,
    });
    if (
      notifError &&
      !/clinica_notificaciones|schema cache|does not exist/i.test(notifError.message || "")
    ) {
      console.error(notifError);
    }
  }

  return data;
}

/* ---------- Vacunas cargadas por el tutor ---------- */
export async function listarVacunasTutor(tutorId, { mascotaId, pacienteId } = {}) {
  let query = supabase
    .from("tutor_vacunas")
    .select(
      "id, tutor_id, mascota_id, paciente_id, nombre, fecha, proxima_fecha, lote, notas, creado_en",
    )
    .eq("tutor_id", tutorId)
    .order("fecha", { ascending: false });
  if (mascotaId) query = query.eq("mascota_id", mascotaId);
  if (pacienteId) query = query.eq("paciente_id", pacienteId);
  const { data, error } = await query;
  if (error) {
    if (/tutor_vacunas|schema cache|does not exist/i.test(error.message)) return [];
    throw missing(error, "vacunas tutor") || new Error(error.message);
  }
  return (data ?? []).map((v) => ({ ...v, origen: "tutor" }));
}

export async function crearVacunaTutor(tutorId, payload) {
  if (!payload?.nombre?.trim()) throw new Error("Indicá el nombre de la vacuna.");
  if (!payload?.fecha) throw new Error("Indicá la fecha de aplicación.");
  if (!payload?.mascota_id && !payload?.paciente_id) {
    throw new Error("Elegí una mascota.");
  }

  const { data, error } = await supabase
    .from("tutor_vacunas")
    .insert({
      tutor_id: tutorId,
      mascota_id: payload.mascota_id || null,
      paciente_id: payload.paciente_id || null,
      nombre: payload.nombre.trim(),
      fecha: payload.fecha,
      proxima_fecha: payload.proxima_fecha || null,
      lote: payload.lote?.trim() || null,
      notas: payload.notas?.trim() || null,
    })
    .select(
      "id, tutor_id, mascota_id, paciente_id, nombre, fecha, proxima_fecha, lote, notas, creado_en",
    )
    .single();

  if (error) {
    if (/tutor_vacunas|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Falta esquema de vacunas del tutor. Ejecutá supabase/chapitas/20_tutor_vacunas.sql.",
      );
    }
    throw missing(error, "vacunas tutor") || new Error(error.message);
  }
  return { ...data, origen: "tutor" };
}

export async function eliminarVacunaTutor(tutorId, vacunaId) {
  const { error } = await supabase
    .from("tutor_vacunas")
    .delete()
    .eq("id", vacunaId)
    .eq("tutor_id", tutorId);
  if (error) {
    if (/tutor_vacunas|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Falta esquema de vacunas del tutor. Ejecutá supabase/chapitas/20_tutor_vacunas.sql.",
      );
    }
    throw missing(error, "vacunas tutor") || new Error(error.message);
  }
}

/* ---------- Tratamientos cargados por el tutor ---------- */
export async function crearTratamientoTutor(tutorId, payload) {
  if (!payload?.titulo?.trim()) throw new Error("Indicá el nombre del tratamiento.");
  if (!payload?.mascota_id && !payload?.paciente_id) {
    throw new Error("Elegí una mascota.");
  }

  const dePorVida = Boolean(payload.de_por_vida);
  const { data, error } = await supabase
    .from("tutor_tratamientos")
    .insert({
      tutor_id: tutorId,
      mascota_id: payload.mascota_id || null,
      paciente_id: payload.paciente_id || null,
      titulo: payload.titulo.trim(),
      detalle: payload.detalle?.trim() || null,
      fecha_inicio: payload.fecha_inicio || new Date().toISOString().slice(0, 10),
      fecha_fin: dePorVida ? null : payload.fecha_fin || null,
      de_por_vida: dePorVida,
      activo: true,
    })
    .select(
      "id, tutor_id, mascota_id, paciente_id, titulo, detalle, fecha_inicio, fecha_fin, de_por_vida, activo, creado_en",
    )
    .single();

  if (error) {
    if (/tutor_tratamientos|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Falta esquema de tratamientos del tutor. Ejecutá supabase/chapitas/34_tutor_tratamientos.sql.",
      );
    }
    throw missing(error, "tratamientos tutor") || new Error(error.message);
  }
  return { ...data, origen: "tutor" };
}

export async function eliminarTratamientoTutor(tutorId, tratamientoId) {
  const { error } = await supabase
    .from("tutor_tratamientos")
    .delete()
    .eq("id", tratamientoId)
    .eq("tutor_id", tutorId);
  if (error) {
    if (/tutor_tratamientos|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Falta esquema de tratamientos del tutor. Ejecutá supabase/chapitas/34_tutor_tratamientos.sql.",
      );
    }
    throw missing(error, "tratamientos tutor") || new Error(error.message);
  }
}

/** Tratamientos activos del tutor (fecha_fin ≥ hoy o de por vida). */
export async function listarTratamientosActivosTutor(tutorId) {
  const hoy = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("tutor_tratamientos")
    .select(
      "id, tutor_id, mascota_id, paciente_id, titulo, detalle, fecha_inicio, fecha_fin, de_por_vida, activo, creado_en",
    )
    .eq("tutor_id", tutorId)
    .eq("activo", true)
    .order("fecha_inicio", { ascending: false });
  if (error) {
    if (/tutor_tratamientos|schema cache|does not exist/i.test(error.message)) return [];
    throw missing(error, "tratamientos tutor") || new Error(error.message);
  }
  return (data ?? [])
    .filter((t) => t.de_por_vida || !t.fecha_fin || t.fecha_fin >= hoy)
    .map((t) => ({ ...t, origen: "tutor" }));
}

/* ---------- Recordatorios cargados por el tutor ---------- */
export async function listarRecordatoriosTutor(tutorId) {
  const { data, error } = await supabase
    .from("tutor_recordatorios")
    .select(
      "id, tutor_id, mascota_id, paciente_id, tipo, titulo, detalle, fecha_proxima, activo, creado_en",
    )
    .eq("tutor_id", tutorId)
    .eq("activo", true)
    .order("fecha_proxima", { ascending: true });
  if (error) {
    if (/tutor_recordatorios|schema cache|does not exist/i.test(error.message)) return [];
    throw missing(error, "recordatorios tutor") || new Error(error.message);
  }
  return (data ?? []).map((r) => ({ ...r, origen: "tutor" }));
}

export async function crearRecordatorioTutor(tutorId, payload) {
  if (!payload?.titulo?.trim()) throw new Error("Indicá el nombre de la medicación.");
  if (!payload?.mascota_id && !payload?.paciente_id) {
    throw new Error("Elegí una mascota.");
  }

  const { data, error } = await supabase
    .from("tutor_recordatorios")
    .insert({
      tutor_id: tutorId,
      mascota_id: payload.mascota_id || null,
      paciente_id: payload.paciente_id || null,
      tipo: payload.tipo || "medicacion",
      titulo: payload.titulo.trim(),
      detalle: payload.detalle?.trim() || null,
      fecha_proxima: payload.fecha_proxima || null,
      activo: true,
    })
    .select(
      "id, tutor_id, mascota_id, paciente_id, tipo, titulo, detalle, fecha_proxima, activo, creado_en",
    )
    .single();

  if (error) {
    if (/tutor_recordatorios|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Falta esquema de recordatorios del tutor. Ejecutá supabase/chapitas/35_tutor_recordatorios.sql.",
      );
    }
    throw missing(error, "recordatorios tutor") || new Error(error.message);
  }
  return { ...data, origen: "tutor" };
}

export async function eliminarRecordatorioTutor(tutorId, recordatorioId) {
  const { error } = await supabase
    .from("tutor_recordatorios")
    .delete()
    .eq("id", recordatorioId)
    .eq("tutor_id", tutorId);
  if (error) {
    if (/tutor_recordatorios|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Falta esquema de recordatorios del tutor. Ejecutá supabase/chapitas/35_tutor_recordatorios.sql.",
      );
    }
    throw missing(error, "recordatorios tutor") || new Error(error.message);
  }
}

/* ---------- Historial clínico ---------- */
export async function historialClinicoTutor(tutorId, email) {
  const { mascotas, clientes } = await listarMascotasTutorCompletas(tutorId, email);
  const chapitaIds = [...new Set(mascotas.map((m) => m.chapita_id).filter(Boolean))];
  const seedPacienteIds = [
    ...new Set(mascotas.map((m) => m.paciente_clinico_id).filter(Boolean)),
  ];

  // Todas las fichas clínicas de las chapitas del tutor (todas las clínicas).
  let pacienteIds = seedPacienteIds;
  /** @type {Map<string, { key: string, nombre: string }>} */
  const metaPorPaciente = new Map();
  const nombrePorChapita = new Map(
    mascotas.filter((m) => m.chapita_id).map((m) => [m.chapita_id, m.nombre]),
  );

  for (const m of mascotas) {
    if (m.paciente_clinico_id) {
      metaPorPaciente.set(m.paciente_clinico_id, {
        key: m.chapita_id || m.paciente_clinico_id,
        nombre: m.nombre,
      });
    }
  }

  if (chapitaIds.length) {
    const orFilter = chapitaIds
      .map((c) => `mascota_chapita_id.eq.${c},chapita_codigo.eq.${c}`)
      .join(",");
    const { data: related, error: relatedError } = await supabase
      .from("clinica_pacientes")
      .select("id, nombre, mascota_chapita_id, chapita_codigo")
      .or(orFilter)
      .eq("activo", true);
    if (relatedError) {
      throw missing(relatedError, "pacientes") || new Error(relatedError.message);
    }
    for (const p of related || []) {
      const chapita = p.mascota_chapita_id || p.chapita_codigo || null;
      metaPorPaciente.set(p.id, {
        key: chapita || p.id,
        nombre: nombrePorChapita.get(chapita) || p.nombre || "Mascota",
      });
    }
    pacienteIds = [
      ...new Set([
        ...seedPacienteIds,
        ...(related || []).map((p) => p.id),
      ]),
    ];
  }

  function tagMascota(row, { mascotaId = null } = {}) {
    const fromPaciente = row?.paciente_id ? metaPorPaciente.get(row.paciente_id) : null;
    const key =
      mascotaId ||
      fromPaciente?.key ||
      row?.clinica_pacientes?.nombre ||
      "mascota";
    const nombre =
      (mascotaId && nombrePorChapita.get(mascotaId)) ||
      fromPaciente?.nombre ||
      row?.clinica_pacientes?.nombre ||
      "Mascota";
    return {
      ...row,
      mascota_key: key,
      mascota_nombre: nombre,
      clinica_pacientes: {
        ...(row?.clinica_pacientes || {}),
        nombre,
      },
    };
  }

  const empty = {
    mascotas,
    clientes,
    consultas: [],
    vacunas: [],
    desparasitaciones: [],
    archivos: [],
    recordatorios: [],
  };

  const tutorVacunasPromise = listarVacunasTutor(tutorId);
  const tutorRecordatoriosPromise = listarRecordatoriosTutor(tutorId);

  function mapTutorRecordatorio(r) {
    return tagMascota(
      {
        ...r,
        clinica_pacientes: {
          nombre: nombrePorChapita.get(r.mascota_id) || "Mascota",
        },
      },
      { mascotaId: r.mascota_id },
    );
  }

  if (!pacienteIds.length) {
    const [tutorVacunas, tutorRecordatorios] = await Promise.all([
      tutorVacunasPromise,
      tutorRecordatoriosPromise,
    ]);
    return {
      ...empty,
      vacunas: tutorVacunas.map((v) =>
        tagMascota(
          {
            ...v,
            clinica_pacientes: { nombre: nombrePorChapita.get(v.mascota_id) || "Mascota" },
          },
          { mascotaId: v.mascota_id },
        ),
      ),
      recordatorios: (tutorRecordatorios || []).map(mapTutorRecordatorio),
    };
  }

  const [
    consultas,
    vacunas,
    desparasitaciones,
    archivos,
    recordatorios,
    tutorVacunas,
    tutorRecordatorios,
  ] = await Promise.all([
    run(
      supabase
        .from("clinica_consultas")
        .select(
          "id, paciente_id, clinica_id, fecha, motivo, diagnostico, tratamiento, medicacion, observaciones, cerrada, firmado_por, clinica_pacientes(id, nombre), clinicas(id, nombre)",
        )
        .in("paciente_id", pacienteIds)
        .order("fecha", { ascending: false }),
      "consultas",
    ),
    run(
      supabase
        .from("clinica_vacunas")
        .select("id, paciente_id, nombre, fecha, proxima_fecha, notas, clinica_pacientes(nombre)")
        .in("paciente_id", pacienteIds)
        .order("fecha", { ascending: false }),
      "vacunas",
    ),
    run(
      supabase
        .from("clinica_desparasitaciones")
        .select("id, paciente_id, producto, fecha, proxima_fecha, notas, clinica_pacientes(nombre)")
        .in("paciente_id", pacienteIds)
        .order("fecha", { ascending: false }),
      "desparasitaciones",
    ),
    run(
      supabase
        .from("clinica_archivos")
        .select("id, paciente_id, nombre, tipo, url, creado_en, clinica_pacientes(nombre)")
        .in("paciente_id", pacienteIds)
        .order("creado_en", { ascending: false }),
      "archivos",
    ),
    run(
      supabase
        .from("clinica_recordatorios")
        .select(
          "id, paciente_id, tipo, titulo, detalle, fecha_proxima, activo, clinica_pacientes(nombre)",
        )
        .in("paciente_id", pacienteIds)
        .eq("activo", true)
        .order("fecha_proxima", { ascending: true }),
      "recordatorios",
    ),
    tutorVacunasPromise,
    tutorRecordatoriosPromise,
  ]);

  const vacunasTutorFiltradas = (tutorVacunas || [])
    .filter(
      (v) =>
        (v.mascota_id && chapitaIds.includes(v.mascota_id)) ||
        (v.paciente_id && pacienteIds.includes(v.paciente_id)),
    )
    .map((v) => tagMascota(v, { mascotaId: v.mascota_id }));

  const vacunasMerged = [
    ...(vacunas ?? []).map((v) => tagMascota(v)),
    ...vacunasTutorFiltradas,
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const recordatoriosTutorFiltrados = (tutorRecordatorios || [])
    .filter(
      (r) =>
        (r.mascota_id && (chapitaIds.includes(r.mascota_id) || nombrePorChapita.has(r.mascota_id))) ||
        (r.paciente_id && pacienteIds.includes(r.paciente_id)) ||
        r.mascota_id,
    )
    .map(mapTutorRecordatorio);

  const recordatoriosMerged = [
    ...(recordatorios ?? []).map((r) => tagMascota({ ...r, origen: "clinica" })),
    ...recordatoriosTutorFiltrados,
  ].sort((a, b) => {
    const da = a.fecha_proxima ? new Date(a.fecha_proxima) : new Date(8640000000000000);
    const db = b.fecha_proxima ? new Date(b.fecha_proxima) : new Date(8640000000000000);
    return da - db;
  });

  return {
    mascotas,
    clientes,
    consultas: (consultas ?? []).map((c) => tagMascota(c)),
    vacunas: vacunasMerged,
    desparasitaciones: (desparasitaciones ?? []).map((d) => tagMascota(d)),
    archivos: (archivos ?? []).map((a) => tagMascota(a)),
    recordatorios: recordatoriosMerged,
  };
}

export function buildHistorialText({ tutor, consultas, vacunas, desparasitaciones, archivos }) {
  const lines = [];
  lines.push("HISTORIAL CLÍNICO — Aguará App");
  lines.push(`Tutor: ${tutor?.nombre_completo || "—"} (${tutor?.email || "—"})`);
  lines.push(`Generado: ${formatDateTime(new Date())}`);
  lines.push("");
  lines.push("=== CONSULTAS ===");
  if (!consultas?.length) lines.push("Sin consultas.");
  for (const c of consultas || []) {
    lines.push(`- ${formatDateTime(c.fecha)} · ${c.clinica_pacientes?.nombre || "Mascota"}`);
    lines.push(`  Motivo: ${c.motivo || "—"}`);
    lines.push(`  Diagnóstico: ${c.diagnostico || "—"}`);
    lines.push(`  Tratamiento: ${c.tratamiento || "—"}`);
    lines.push(`  Medicación: ${c.medicacion || "—"}`);
    lines.push("");
  }
  lines.push("=== VACUNAS ===");
  if (!vacunas?.length) lines.push("Sin vacunas.");
  for (const v of vacunas || []) {
    lines.push(
      `- ${v.clinica_pacientes?.nombre || "Mascota"} · ${v.nombre} · ${formatDate(v.fecha)}${v.proxima_fecha ? ` · próxima ${formatDate(v.proxima_fecha)}` : ""}`,
    );
  }
  lines.push("");
  lines.push("=== DESPARASITACIONES ===");
  if (!desparasitaciones?.length) lines.push("Sin registros.");
  for (const d of desparasitaciones || []) {
    lines.push(
      `- ${d.clinica_pacientes?.nombre || "Mascota"} · ${d.producto} · ${formatDate(d.fecha)}${d.proxima_fecha ? ` · próxima ${formatDate(d.proxima_fecha)}` : ""}`,
    );
  }
  lines.push("");
  lines.push("=== ARCHIVOS ===");
  if (!archivos?.length) lines.push("Sin archivos.");
  for (const a of archivos || []) {
    lines.push(`- ${a.nombre} (${a.tipo}) · ${a.url}`);
  }
  return lines.join("\n");
}

export function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Cambios de perfil propuestos por clínicas ---------- */
const SOLICITUD_SELECT =
  "id, clinica_id, cliente_id, tutor_id, datos_anteriores, datos_propuestos, estado, creado_en, resuelto_en, clinicas(id, nombre, ciudad)";

export async function listarNotificacionesTutor(tutorId, { soloNoLeidas = false } = {}) {
  let query = supabase
    .from("tutor_notificaciones")
    .select("id, tipo, titulo, mensaje, solicitud_id, leida, creado_en")
    .eq("tutor_id", tutorId)
    .order("creado_en", { ascending: false })
    .limit(30);
  if (soloNoLeidas) query = query.eq("leida", false);
  const { data, error } = await query;
  if (error) {
    if (/tutor_notificaciones|schema cache|does not exist/i.test(error.message)) return [];
    throw missing(error, "notificaciones tutor") || new Error(error.message);
  }
  return data ?? [];
}

export async function marcarNotificacionesTutorLeidas(tutorId, { soloTiposCita = false } = {}) {
  let query = supabase
    .from("tutor_notificaciones")
    .update({ leida: true })
    .eq("tutor_id", tutorId)
    .eq("leida", false);
  if (soloTiposCita) {
    query = query.in("tipo", ["cita_confirmada", "cita_cancelada", "cita_reprogramada"]);
  }
  const { error } = await query;
  if (error && !/tutor_notificaciones|schema cache|does not exist/i.test(error.message || "")) {
    throw missing(error, "notificaciones tutor") || new Error(error.message);
  }
}

export async function listarSolicitudesPerfilTutor(tutorId, { soloPendientes = true } = {}) {
  let query = supabase
    .from("tutor_perfil_solicitudes")
    .select(SOLICITUD_SELECT)
    .eq("tutor_id", tutorId)
    .order("creado_en", { ascending: false });
  if (soloPendientes) query = query.eq("estado", "pendiente");
  const { data, error } = await query;
  if (error) {
    if (/tutor_perfil_solicitudes|schema cache|does not exist/i.test(error.message)) return [];
    throw missing(error, "solicitudes perfil") || new Error(error.message);
  }
  return data ?? [];
}

async function marcarNotificacionesSolicitudLeidas(solicitudId) {
  if (!solicitudId) return;
  await supabase
    .from("tutor_notificaciones")
    .update({ leida: true })
    .eq("solicitud_id", solicitudId);
}

export async function aceptarCambioPerfilTutor(tutorId, solicitudId) {
  const { data: solicitud, error } = await supabase
    .from("tutor_perfil_solicitudes")
    .select(SOLICITUD_SELECT)
    .eq("id", solicitudId)
    .eq("tutor_id", tutorId)
    .eq("estado", "pendiente")
    .single();
  if (error || !solicitud) {
    if (/tutor_perfil_solicitudes|schema cache|does not exist/i.test(error?.message || "")) {
      throw new Error(
        "Falta esquema de cambios de perfil. Ejecutá supabase/chapitas/18_tutor_cambio_perfil.sql.",
      );
    }
    throw new Error("La solicitud ya no está pendiente.");
  }

  const propuesto = solicitud.datos_propuestos || {};
  const tutorUpdated = await run(
    supabase
      .from("tutores")
      .update({
        nombre_completo: String(propuesto.nombre_completo || "").trim(),
        telefono: String(propuesto.telefono || "").trim(),
        telefono_secundario: propuesto.telefono_secundario
          ? String(propuesto.telefono_secundario).trim()
          : null,
        direccion: propuesto.direccion ? String(propuesto.direccion).trim() : null,
      })
      .eq("id", tutorId)
      .select(
        "id, nombre_completo, email, telefono, telefono_secundario, direccion, clinica_preferida_id",
      )
      .single(),
    "tutores",
  );

  // Sincronizar cliente(s) vinculados al tutor (al menos el de la solicitud)
  const syncPayload = {
    nombre_completo: tutorUpdated.nombre_completo,
    telefono: tutorUpdated.telefono,
    telefono_secundario: tutorUpdated.telefono_secundario,
    direccion: tutorUpdated.direccion,
  };
  if (solicitud.cliente_id) {
    await supabase.from("clinica_clientes").update(syncPayload).eq("id", solicitud.cliente_id);
  }
  await supabase.from("clinica_clientes").update(syncPayload).eq("tutor_id", tutorId);

  await supabase
    .from("tutor_perfil_solicitudes")
    .update({ estado: "aceptada", resuelto_en: new Date().toISOString() })
    .eq("id", solicitudId);

  await marcarNotificacionesSolicitudLeidas(solicitudId);
  return tutorUpdated;
}

/* ---------- Compartir perfil con clínicas ---------- */
export async function listarSolicitudesCompartirTutor(tutorId, { soloPendientes = true } = {}) {
  let query = supabase
    .from("tutor_compartir_clinica")
    .select(
      "id, clinica_id, tutor_id, estado, mensaje, creado_en, resuelto_en, mascota_id, clinicas(id, nombre, ciudad)",
    )
    .eq("tutor_id", tutorId)
    .order("creado_en", { ascending: false });
  if (soloPendientes) query = query.eq("estado", "pendiente");
  const { data, error } = await query;
  if (error) {
    if (/tutor_compartir_clinica|schema cache|does not exist/i.test(error.message)) return [];
    // Compat sin columna mascota_id
    if (/mascota_id|schema cache|does not exist/i.test(error.message)) {
      let q2 = supabase
        .from("tutor_compartir_clinica")
        .select(
          "id, clinica_id, tutor_id, estado, mensaje, creado_en, resuelto_en, clinicas(id, nombre, ciudad)",
        )
        .eq("tutor_id", tutorId)
        .order("creado_en", { ascending: false });
      if (soloPendientes) q2 = q2.eq("estado", "pendiente");
      const legacy = await q2;
      if (legacy.error) {
        if (/tutor_compartir_clinica|schema cache|does not exist/i.test(legacy.error.message)) {
          return [];
        }
        throw missing(legacy.error, "compartir perfil") || new Error(legacy.error.message);
      }
      return (legacy.data ?? []).map((r) => ({ ...r, mascota_id: null }));
    }
    throw missing(error, "compartir perfil") || new Error(error.message);
  }
  return data ?? [];
}

/** ¿El tutor ya autorizó HC a esta clínica? */
export async function tutorTienePermisoHcConClinica(tutorId, clinicaId) {
  if (!tutorId || !clinicaId) return false;
  const { data, error } = await supabase
    .from("tutor_compartir_clinica")
    .select("id")
    .eq("clinica_id", clinicaId)
    .eq("tutor_id", tutorId)
    .eq("estado", "aceptada")
    .maybeSingle();
  if (error) {
    if (/tutor_compartir_clinica|schema cache|does not exist/i.test(error.message)) {
      return false;
    }
    throw missing(error, "compartir perfil") || new Error(error.message);
  }
  return Boolean(data);
}

/**
 * Otorga (o reactiva) el permiso de HC a una clínica, iniciado por el tutor
 * (p. ej. al sacar un turno). No requiere solicitud previa.
 */
export async function otorgarCompartirHcTutor({
  tutorId,
  clinicaId,
  mascotaId,
  mensaje = "Autorizado al sacar turno",
}) {
  if (!tutorId || !clinicaId) {
    throw new Error("Faltan datos de clínica o tutor para compartir el historial.");
  }
  if (!mascotaId) {
    throw new Error(
      "Para compartir el historial necesitás una mascota con chapita QR vinculada.",
    );
  }

  const { data: existing, error: findError } = await supabase
    .from("tutor_compartir_clinica")
    .select("id, estado, mascota_id")
    .eq("clinica_id", clinicaId)
    .eq("tutor_id", tutorId)
    .maybeSingle();

  if (findError) {
    if (/tutor_compartir_clinica|schema cache|does not exist/i.test(findError.message)) {
      throw new Error(
        "Falta esquema de compartir perfil. Ejecutá supabase/chapitas/21_tutor_compartir_clinica.sql.",
      );
    }
    throw missing(findError, "compartir perfil") || new Error(findError.message);
  }

  const payloadFull = {
    estado: "aceptada",
    resuelto_en: new Date().toISOString(),
    mascota_id: mascotaId,
    mensaje: mensaje || null,
  };

  let row = null;

  if (existing?.id) {
    let { data, error } = await supabase
      .from("tutor_compartir_clinica")
      .update(payloadFull)
      .eq("id", existing.id)
      .eq("tutor_id", tutorId)
      .select("id, clinica_id, estado, mascota_id")
      .single();

    if (error && /mascota_id|schema cache|does not exist/i.test(error.message || "")) {
      ({ data, error } = await supabase
        .from("tutor_compartir_clinica")
        .update({
          estado: "aceptada",
          resuelto_en: payloadFull.resuelto_en,
          mensaje: payloadFull.mensaje,
        })
        .eq("id", existing.id)
        .eq("tutor_id", tutorId)
        .select("id, clinica_id, estado")
        .single());
    }
    if (error) throw missing(error, "compartir perfil") || new Error(error.message);
    row = data;
  } else {
    let { data, error } = await supabase
      .from("tutor_compartir_clinica")
      .insert({
        clinica_id: clinicaId,
        tutor_id: tutorId,
        ...payloadFull,
      })
      .select("id, clinica_id, estado, mascota_id")
      .single();

    if (error && /mascota_id|schema cache|does not exist/i.test(error.message || "")) {
      ({ data, error } = await supabase
        .from("tutor_compartir_clinica")
        .insert({
          clinica_id: clinicaId,
          tutor_id: tutorId,
          estado: "aceptada",
          resuelto_en: payloadFull.resuelto_en,
          mensaje: payloadFull.mensaje,
        })
        .select("id, clinica_id, estado")
        .single());
    }
    if (error) {
      if (/tutor_compartir_clinica|schema cache|does not exist/i.test(error.message || "")) {
        throw new Error(
          "Falta esquema de compartir perfil. Ejecutá supabase/chapitas/21_tutor_compartir_clinica.sql.",
        );
      }
      throw missing(error, "compartir perfil") || new Error(error.message);
    }
    row = data;
  }

  try {
    await sincronizarMascotaCompartidaEnClinica({
      clinicaId,
      tutorId,
      mascotaId,
    });
  } catch (syncError) {
    console.error("No se pudo sincronizar la mascota al otorgar HC:", syncError);
  }

  return row;
}

/** Permisos activos (y recientes) para ver/gestionar HC compartida con clínicas. */
export async function listarPermisosHcTutor(tutorId) {
  const rows = await listarSolicitudesCompartirTutor(tutorId, { soloPendientes: false });
  const activos = rows.filter((r) => r.estado === "aceptada");
  const mascotaIds = [...new Set(activos.map((r) => r.mascota_id).filter(Boolean))];
  let nombres = new Map();
  if (mascotaIds.length) {
    const { data: mascotas } = await supabase
      .from("mascotas")
      .select("id, nombre_mascota")
      .in("id", mascotaIds);
    nombres = new Map((mascotas || []).map((m) => [m.id, m.nombre_mascota]));
  }
  return activos.map((r) => ({
    ...r,
    mascota_nombre: r.mascota_id ? nombres.get(r.mascota_id) || null : null,
  }));
}

/**
 * Quita el permiso de compartir HC con una clínica.
 * No borra pacientes ni historias creadas por esa clínica.
 */
export async function revocarCompartirHcTutor(tutorId, shareId) {
  const { data, error } = await supabase
    .from("tutor_compartir_clinica")
    .update({ estado: "revocada", resuelto_en: new Date().toISOString() })
    .eq("id", shareId)
    .eq("tutor_id", tutorId)
    .eq("estado", "aceptada")
    .select("id, clinica_id, estado")
    .maybeSingle();
  if (error) {
    if (/tutor_compartir_clinica|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Falta esquema de compartir perfil. Ejecutá supabase/chapitas/21_tutor_compartir_clinica.sql.",
      );
    }
    if (/revocada|check constraint/i.test(error.message || "")) {
      throw new Error(
        "No se pudo revocar. Verificá que el esquema permita el estado “revocada” (21_tutor_compartir_clinica.sql).",
      );
    }
    throw missing(error, "compartir perfil") || new Error(error.message);
  }
  if (!data) throw new Error("Ese permiso ya no está activo.");
  return data;
}

export async function aceptarCompartirPerfilTutor(tutorId, solicitudId, mascotaId) {
  if (!mascotaId) {
    throw new Error("Elegí qué mascota autorizás a compartir con la clínica.");
  }

  const payload = {
    estado: "aceptada",
    resuelto_en: new Date().toISOString(),
    mascota_id: mascotaId,
  };

  let { data, error } = await supabase
    .from("tutor_compartir_clinica")
    .update(payload)
    .eq("id", solicitudId)
    .eq("tutor_id", tutorId)
    .eq("estado", "pendiente")
    .select("id, clinica_id, estado, mascota_id")
    .maybeSingle();

  // Compat: si aún no corrieron 26_compartir_mascota.sql
  if (error && /mascota_id|schema cache|does not exist/i.test(error.message)) {
    ({ data, error } = await supabase
      .from("tutor_compartir_clinica")
      .update({ estado: "aceptada", resuelto_en: new Date().toISOString() })
      .eq("id", solicitudId)
      .eq("tutor_id", tutorId)
      .eq("estado", "pendiente")
      .select("id, clinica_id, estado")
      .maybeSingle());
  }

  if (error) {
    if (/tutor_compartir_clinica|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Falta esquema de compartir perfil. Ejecutá supabase/chapitas/21_tutor_compartir_clinica.sql.",
      );
    }
    throw missing(error, "compartir perfil") || new Error(error.message);
  }
  if (!data) throw new Error("La solicitud ya no está pendiente.");

  try {
    await sincronizarMascotaCompartidaEnClinica({
      clinicaId: data.clinica_id,
      tutorId,
      mascotaId,
    });
  } catch (syncError) {
    console.error("No se pudo dar de alta la mascota compartida como paciente:", syncError);
  }

  return data;
}

export async function rechazarCompartirPerfilTutor(tutorId, solicitudId) {
  const { data, error } = await supabase
    .from("tutor_compartir_clinica")
    .update({ estado: "rechazada", resuelto_en: new Date().toISOString() })
    .eq("id", solicitudId)
    .eq("tutor_id", tutorId)
    .eq("estado", "pendiente")
    .select("id")
    .maybeSingle();
  if (error) {
    if (/tutor_compartir_clinica|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Falta esquema de compartir perfil. Ejecutá supabase/chapitas/21_tutor_compartir_clinica.sql.",
      );
    }
    throw missing(error, "compartir perfil") || new Error(error.message);
  }
  if (!data) throw new Error("La solicitud ya no está pendiente.");
  return data;
}

export async function rechazarCambioPerfilTutor(tutorId, solicitudId) {
  const { data, error } = await supabase
    .from("tutor_perfil_solicitudes")
    .update({ estado: "rechazada", resuelto_en: new Date().toISOString() })
    .eq("id", solicitudId)
    .eq("tutor_id", tutorId)
    .eq("estado", "pendiente")
    .select("id")
    .maybeSingle();
  if (error) {
    if (/tutor_perfil_solicitudes|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Falta esquema de cambios de perfil. Ejecutá supabase/chapitas/18_tutor_cambio_perfil.sql.",
      );
    }
    throw missing(error, "solicitudes perfil") || new Error(error.message);
  }
  if (!data) throw new Error("La solicitud ya no está pendiente.");
  await marcarNotificacionesSolicitudLeidas(solicitudId);
  return data;
}

export function buildConsultaText(consulta) {
  return [
    "CONSULTA CLÍNICA — Aguará App",
    `Fecha: ${formatDateTime(consulta.fecha)}`,
    `Mascota: ${consulta.clinica_pacientes?.nombre || "—"}`,
    `Motivo: ${consulta.motivo || "—"}`,
    `Diagnóstico: ${consulta.diagnostico || "—"}`,
    `Tratamiento: ${consulta.tratamiento || "—"}`,
    `Medicación: ${consulta.medicacion || "—"}`,
    `Observaciones: ${consulta.observaciones || "—"}`,
    `Firmado por: ${consulta.firmado_por || "—"}`,
  ].join("\n");
}
