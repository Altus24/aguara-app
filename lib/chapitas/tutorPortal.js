import { supabase } from "@/lib/chapitas/supabaseClient";
import {
  endOfDayISO,
  etiquetaEstado,
  listarCitasRango,
  listarVeterinarios,
  startOfDayISO,
} from "@/lib/chapitas/clinicaOps";
import { listarHorarios } from "@/lib/chapitas/clinicas";

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

export { etiquetaEstado };

/* ---------- Perfil ---------- */
export async function obtenerTutor(id) {
  return run(
    supabase
      .from("tutores")
      .select("id, nombre_completo, email, telefono, telefono_secundario, direccion, clinica_preferida_id")
      .eq("id", id)
      .single(),
    "tutores",
  );
}

export async function actualizarTutor(id, payload) {
  return run(
    supabase
      .from("tutores")
      .update({
        nombre_completo: payload.nombre_completo.trim(),
        telefono: payload.telefono.trim(),
        telefono_secundario: payload.telefono_secundario?.trim() || null,
        direccion: payload.direccion?.trim() || null,
        clinica_preferida_id: payload.clinica_preferida_id || null,
      })
      .eq("id", id)
      .select("id, nombre_completo, email, telefono, telefono_secundario, direccion, clinica_preferida_id")
      .single(),
    "tutores",
  );
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

function parseTimeToMinutes(value) {
  const raw = String(value || "").slice(0, 5);
  const [h, m] = raw.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Genera turnos de 30 min dentro de los horarios de la clínica para una fecha. */
export function generarSlotsDisponibles(horarios, fechaISO, citasOcupadas = [], slotMinutos = 30) {
  const date = new Date(`${fechaISO}T12:00:00`);
  if (Number.isNaN(date.getTime())) return [];
  const dia = date.getDay();
  const ranges = (horarios || []).filter(
    (h) => Number(h.dia_semana) === dia && h.activo !== false,
  );
  const ocupados = new Set(
    (citasOcupadas || [])
      .filter((c) => c.inicio && !["cancelada", "no_asistio"].includes(c.estado))
      .map((c) => {
        const d = new Date(c.inicio);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }),
  );

  const slots = [];
  for (const range of ranges) {
    let cursor = parseTimeToMinutes(range.hora_inicio);
    const end = parseTimeToMinutes(range.hora_fin);
    while (cursor + slotMinutos <= end) {
      const label = minutesToTime(cursor);
      if (!ocupados.has(label)) slots.push(label);
      cursor += slotMinutos;
    }
  }
  return [...new Set(slots)].sort();
}

/** Horarios efectivos de un veterinario (propios; si no tiene, fallback al general legado). */
export function horariosDeVeterinario(horarios, veterinarioId) {
  const all = horarios || [];
  if (!veterinarioId) return all.filter((h) => !h.veterinario_id);
  const propios = all.filter((h) => h.veterinario_id === veterinarioId);
  if (propios.length > 0) return propios;
  return all.filter((h) => !h.veterinario_id);
}

export async function listarVeterinariosParaTurnos(clinicaId) {
  const vets = await listarVeterinarios(clinicaId);
  return vets.filter((v) => v.activo !== false);
}

export async function listarHorariosYOcupacion(clinicaId, fechaISO, veterinarioId) {
  const day = new Date(`${fechaISO}T12:00:00`);
  const [horariosAll, citasAll] = await Promise.all([
    listarHorarios(clinicaId),
    listarCitasRango(clinicaId, startOfDayISO(day), endOfDayISO(day)),
  ]);
  const horarios = veterinarioId
    ? horariosDeVeterinario(horariosAll, veterinarioId)
    : horariosAll.filter((h) => !h.veterinario_id);
  // Solo bloquean el slot las citas del mismo veterinario (u otras sin vet asignado)
  const citas = veterinarioId
    ? citasAll.filter((c) => !c.veterinario_id || c.veterinario_id === veterinarioId)
    : citasAll;
  return {
    horarios,
    citas,
    slots: generarSlotsDisponibles(horarios, fechaISO, citas),
  };
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
    .select("id, cliente_id, clinica_id")
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
  if (existingRows?.[0]) return existingRows[0];

  return run(
    supabase
      .from("clinica_pacientes")
      .insert({
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
      })
      .select("id, cliente_id, clinica_id")
      .single(),
    "pacientes",
  );
}

export async function notificarClinicaTurnoPendiente({
  clinicaId,
  citaId,
  tutorNombre,
  mascotaNombre,
  inicioISO,
}) {
  const cuando = inicioISO
    ? new Date(inicioISO).toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "sin horario";
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
}) {
  if (!clinicaId) throw new Error("Elegí una clínica.");
  if (!veterinarioId) throw new Error("Elegí un veterinario.");
  if (!mascota) throw new Error("Elegí una mascota.");
  if (!fecha || !hora) throw new Error("Elegí fecha y horario disponible.");

  const inicioLocal = new Date(`${fecha}T${hora}:00`);
  if (Number.isNaN(inicioLocal.getTime())) throw new Error("Fecha/hora inválida.");
  const finLocal = new Date(inicioLocal.getTime() + 30 * 60 * 1000);
  const inicioISO = inicioLocal.toISOString();
  const finISO = finLocal.toISOString();

  // Validar que el slot siga dentro de horarios del veterinario y libre
  const { horarios, citas } = await listarHorariosYOcupacion(
    clinicaId,
    fecha,
    veterinarioId,
  );
  if (!horarios.length) {
    throw new Error("Ese veterinario no tiene horarios cargados para ese día.");
  }
  const slots = generarSlotsDisponibles(
    horarios,
    fecha,
    citaId ? citas.filter((c) => c.id !== citaId) : citas,
  );
  if (!slots.includes(hora)) {
    throw new Error("Ese horario ya no está disponible. Elegí otro.");
  }

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
      veterinario_id: veterinarioId,
    });
  } else {
    cita = await solicitarCitaTutor({
      clinica_id: clinicaId,
      paciente_id: paciente.id,
      cliente_id: cliente.id,
      veterinario_id: veterinarioId,
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
  const chapitas =
    (await run(
      supabase
        .from("mascotas")
        .select(
          "id, nombre_mascota, especie, raza, foto_url, fecha_nacimiento, sexo, creado_en, tutor_id",
        )
        .eq("tutor_id", tutorId)
        .order("creado_en", { ascending: false }),
      "mascotas",
    )) ?? [];

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
    return {
      key: `chapita-${m.id}`,
      origen: "chapita",
      chapita_id: m.id,
      paciente_clinico_id: clinico?.id || null,
      clinica_id: clinico?.clinica_id || null,
      cliente_id: clinico?.cliente_id || null,
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
  for (const p of clinicos) {
    const code = p.mascota_chapita_id || p.chapita_codigo;
    if (code && linkedChapitas.has(code)) continue;
    merged.push({
      key: `clinico-${p.id}`,
      origen: "clinico",
      chapita_id: code || null,
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

  if (byTutor.length || !emailNorm) return byTutor;

  const byEmail =
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

  return byEmail.map((c) => ({ ...c, tutor_id: tutorId }));
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
        .neq("estado", "cancelada")
        .order("inicio", { ascending: true }),
      "citas",
    )) ?? [];

  const now = Date.now();
  const proximas = [];
  const pasadas = [];
  for (const cita of rows) {
    const ts = cita.inicio ? new Date(cita.inicio).getTime() : null;
    const isPast =
      cita.estado === "finalizada" ||
      cita.estado === "no_asistio" ||
      (ts != null && ts < now && !["pendiente", "confirmada", "en_espera", "en_atencion", "lista_espera"].includes(cita.estado));
    // Upcoming: future start OR open statuses without being finalized
    if (
      ["pendiente", "confirmada", "en_espera", "en_atencion", "lista_espera"].includes(cita.estado) &&
      (ts == null || ts >= now - 60 * 60 * 1000)
    ) {
      proximas.push(cita);
    } else if (isPast || (ts != null && ts < now)) {
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

/* ---------- Historial clínico ---------- */
export async function historialClinicoTutor(tutorId, email) {
  const { mascotas, clientes } = await listarMascotasTutorCompletas(tutorId, email);
  const pacienteIds = mascotas.map((m) => m.paciente_clinico_id).filter(Boolean);
  const chapitaIds = mascotas.map((m) => m.chapita_id).filter(Boolean);

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

  if (!pacienteIds.length) {
    const tutorVacunas = await tutorVacunasPromise;
    const byMascota = new Map(mascotas.map((m) => [m.chapita_id, m.nombre]));
    return {
      ...empty,
      vacunas: tutorVacunas.map((v) => ({
        ...v,
        clinica_pacientes: { nombre: byMascota.get(v.mascota_id) || "Mascota" },
      })),
    };
  }

  const [consultas, vacunas, desparasitaciones, archivos, recordatorios, tutorVacunas] =
    await Promise.all([
      run(
        supabase
          .from("clinica_consultas")
          .select(
            "id, paciente_id, fecha, motivo, diagnostico, tratamiento, medicacion, observaciones, cerrada, firmado_por, clinica_pacientes(id, nombre)",
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
    ]);

  const nombrePorChapita = new Map(mascotas.map((m) => [m.chapita_id, m.nombre]));
  const nombrePorPaciente = new Map(
    mascotas
      .filter((m) => m.paciente_clinico_id)
      .map((m) => [m.paciente_clinico_id, m.nombre]),
  );

  const vacunasTutorFiltradas = (tutorVacunas || [])
    .filter(
      (v) =>
        (v.mascota_id && chapitaIds.includes(v.mascota_id)) ||
        (v.paciente_id && pacienteIds.includes(v.paciente_id)),
    )
    .map((v) => ({
      ...v,
      clinica_pacientes: {
        nombre:
          nombrePorChapita.get(v.mascota_id) ||
          nombrePorPaciente.get(v.paciente_id) ||
          "Mascota",
      },
    }));

  const vacunasMerged = [...(vacunas ?? []), ...vacunasTutorFiltradas].sort(
    (a, b) => new Date(b.fecha) - new Date(a.fecha),
  );

  return {
    mascotas,
    clientes,
    consultas: consultas ?? [],
    vacunas: vacunasMerged,
    desparasitaciones: desparasitaciones ?? [],
    archivos: archivos ?? [],
    recordatorios: recordatorios ?? [],
  };
}

export function buildHistorialText({ tutor, consultas, vacunas, desparasitaciones, archivos }) {
  const lines = [];
  lines.push("HISTORIAL CLÍNICO — Aguará App");
  lines.push(`Tutor: ${tutor?.nombre_completo || "—"} (${tutor?.email || "—"})`);
  lines.push(`Generado: ${new Date().toLocaleString("es-AR")}`);
  lines.push("");
  lines.push("=== CONSULTAS ===");
  if (!consultas?.length) lines.push("Sin consultas.");
  for (const c of consultas || []) {
    lines.push(`- ${new Date(c.fecha).toLocaleString("es-AR")} · ${c.clinica_pacientes?.nombre || "Mascota"}`);
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
      `- ${v.clinica_pacientes?.nombre || "Mascota"} · ${v.nombre} · ${v.fecha}${v.proxima_fecha ? ` · próxima ${v.proxima_fecha}` : ""}`,
    );
  }
  lines.push("");
  lines.push("=== DESPARASITACIONES ===");
  if (!desparasitaciones?.length) lines.push("Sin registros.");
  for (const d of desparasitaciones || []) {
    lines.push(
      `- ${d.clinica_pacientes?.nombre || "Mascota"} · ${d.producto} · ${d.fecha}${d.proxima_fecha ? ` · próxima ${d.proxima_fecha}` : ""}`,
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
      "id, clinica_id, tutor_id, estado, mensaje, creado_en, resuelto_en, clinicas(id, nombre, ciudad)",
    )
    .eq("tutor_id", tutorId)
    .order("creado_en", { ascending: false });
  if (soloPendientes) query = query.eq("estado", "pendiente");
  const { data, error } = await query;
  if (error) {
    if (/tutor_compartir_clinica|schema cache|does not exist/i.test(error.message)) return [];
    throw missing(error, "compartir perfil") || new Error(error.message);
  }
  return data ?? [];
}

export async function aceptarCompartirPerfilTutor(tutorId, solicitudId) {
  const { data, error } = await supabase
    .from("tutor_compartir_clinica")
    .update({ estado: "aceptada", resuelto_en: new Date().toISOString() })
    .eq("id", solicitudId)
    .eq("tutor_id", tutorId)
    .eq("estado", "pendiente")
    .select("id, clinica_id, estado")
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
    `Fecha: ${new Date(consulta.fecha).toLocaleString("es-AR")}`,
    `Mascota: ${consulta.clinica_pacientes?.nombre || "—"}`,
    `Motivo: ${consulta.motivo || "—"}`,
    `Diagnóstico: ${consulta.diagnostico || "—"}`,
    `Tratamiento: ${consulta.tratamiento || "—"}`,
    `Medicación: ${consulta.medicacion || "—"}`,
    `Observaciones: ${consulta.observaciones || "—"}`,
    `Firmado por: ${consulta.firmado_por || "—"}`,
  ].join("\n");
}
