import { validarDisponibilidadVeterinario } from "@/lib/chapitas/agendaDisponibilidad";
import {
  getCanonicalInsertChapitaId,
  normalizeChapitaId,
} from "@/lib/chapitas/chapitaId";
import { dispatchPushNotification } from "@/lib/chapitas/dispatchPush";
import { formatDateTime } from "@/lib/dateFormat";
import {
  chapitaDisponibleParaActivar,
  crearMascotaConIdentificador,
  crearMascotaSinChapita,
} from "@/lib/chapitas/mascotasTutor";
import { supabase } from "@/lib/chapitas/supabaseClient";
import { buscarTutorPorContacto, crearTutor } from "@/lib/chapitas/tutores";
import { proximaFechaDesdeAplicacion } from "@/lib/chapitas/vacunas";

function missing(error, label = "operativa clínica") {
  if (/clinica_|schema cache|does not exist/i.test(error?.message || "")) {
    return new Error(
      `Falta el esquema de ${label}. Ejecutá supabase/chapitas/11_clinica_operativa.sql en Supabase.`,
    );
  }
  return null;
}

async function run(query, label) {
  const { data, error } = await query;
  if (error) throw missing(error, label) || new Error(error.message);
  return data;
}

export const CITA_ESTADOS = [
  { id: "pendiente", label: "A confirmar" },
  { id: "confirmada", label: "Confirmado" },
  { id: "en_espera", label: "En espera" },
  { id: "en_atencion", label: "En atención" },
  { id: "finalizada", label: "Realizada" },
  { id: "no_asistio", label: "No asistió" },
  { id: "cancelada", label: "Cancelada" },
  { id: "lista_espera", label: "Lista de espera" },
];

/** Estados de agenda con color propio (leyenda: disponible / a confirmar / confirmado). */
export const CITA_ESTADOS_AGENDA = [
  { id: "pendiente", label: "A confirmar" },
  { id: "confirmada", label: "Confirmado" },
];

const ESTADOS_ABIERTOS = new Set([
  "pendiente",
  "confirmada",
  "en_espera",
  "en_atencion",
  "lista_espera",
]);

export function etiquetaEstado(estado) {
  return CITA_ESTADOS.find((e) => e.id === estado)?.label || estado;
}

/**
 * Etiqueta para el tutor en historial / citas pasadas.
 * Si la hora ya pasó y la clínica no cerró el turno, no se muestra "Confirmada".
 */
export function etiquetaEstadoCitaTutor(cita, { ahora = new Date() } = {}) {
  const estado = cita?.estado;
  const inicio = cita?.inicio ? new Date(cita.inicio) : null;
  const fin = cita?.fin ? new Date(cita.fin) : null;
  const refFin = fin && !Number.isNaN(fin.getTime()) ? fin : inicio;
  const yaPaso =
    refFin && !Number.isNaN(refFin.getTime()) ? refFin.getTime() < ahora.getTime() : false;

  if (estado === "finalizada") return "Realizada";
  if (estado === "no_asistio") return "No asistió";
  if (estado === "cancelada") return "Cancelada";
  if (yaPaso && ESTADOS_ABIERTOS.has(estado)) return "Por confirmar asistencia";
  return etiquetaEstado(estado);
}

/** True si el horario del turno ya terminó (solo mira fecha/hora, no el estado). */
export function esHorarioCitaPasado(cita, { ahora = new Date() } = {}) {
  const inicio = cita?.inicio ? new Date(cita.inicio) : null;
  const fin = cita?.fin ? new Date(cita.fin) : null;
  const refFin = fin && !Number.isNaN(fin.getTime()) ? fin : inicio;
  if (!refFin || Number.isNaN(refFin.getTime())) return false;
  return refFin.getTime() < ahora.getTime();
}

/**
 * Notificación de turno ya no debe alertar: finalizada / no asistió, o el horario ya pasó.
 * Cancelaciones futuras siguen visibles hasta leerse.
 */
export function esNotificacionCitaVencida(cita, { ahora = new Date() } = {}) {
  if (!cita) return true;
  const estado = cita.estado;
  if (estado === "finalizada" || estado === "no_asistio") return true;
  return esHorarioCitaPasado(cita, { ahora });
}

export function esCitaPasada(cita, { ahora = new Date() } = {}) {
  const estado = cita?.estado;
  if (estado === "finalizada" || estado === "no_asistio" || estado === "cancelada") {
    return true;
  }
  if (estado === "en_espera" || estado === "en_atencion") return false;
  return esHorarioCitaPasado(cita, { ahora });
}

export function startOfDayISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function endOfDayISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function addDaysISO(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function money(n) {
  return `$${Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

const VET_SELECT =
  "id, nombre, especialidad, email, matricula, firma_digital, color, activo";

/* ---------- Veterinarios ---------- */
export async function listarVeterinarios(clinicaId) {
  return (
    (await run(
      supabase
        .from("clinica_veterinarios")
        .select(VET_SELECT)
        .eq("clinica_id", clinicaId)
        .order("nombre"),
      "veterinarios",
    )) ?? []
  );
}

export async function obtenerVeterinario(id) {
  return run(
    supabase.from("clinica_veterinarios").select(VET_SELECT).eq("id", id).single(),
    "veterinarios",
  );
}

export async function crearVeterinario(clinicaId, payload) {
  return run(
    supabase
      .from("clinica_veterinarios")
      .insert({
        clinica_id: clinicaId,
        nombre: payload.nombre.trim(),
        especialidad: payload.especialidad?.trim() || null,
        email: payload.email?.trim() || null,
        matricula: payload.matricula?.trim() || null,
        firma_digital: payload.firma_digital || null,
        color: payload.color || "#F37021",
      })
      .select(VET_SELECT)
      .single(),
    "veterinarios",
  );
}

export async function actualizarVeterinario(id, payload) {
  return run(
    supabase
      .from("clinica_veterinarios")
      .update({
        nombre: payload.nombre.trim(),
        especialidad: payload.especialidad?.trim() || null,
        email: payload.email?.trim() || null,
        matricula: payload.matricula?.trim() || null,
        firma_digital: payload.firma_digital || null,
        color: payload.color || "#F37021",
        activo: payload.activo !== false,
      })
      .eq("id", id)
      .select(VET_SELECT)
      .single(),
    "veterinarios",
  );
}

export async function eliminarVeterinario(id) {
  await run(supabase.from("clinica_veterinarios").delete().eq("id", id), "veterinarios");
}

/* ---------- Clientes ---------- */
const CLIENTE_SELECT =
  "id, clinica_id, tutor_id, nombre_completo, email, telefono, telefono_secundario, direccion, notas, creado_en";

export async function listarClientes(clinicaId, q = "") {
  let query = supabase
    .from("clinica_clientes")
    .select(CLIENTE_SELECT)
    .eq("clinica_id", clinicaId)
    .order("nombre_completo");
  if (q.trim()) {
    query = query.or(
      `nombre_completo.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%,telefono.ilike.%${q.trim()}%`,
    );
  }
  return (await run(query, "clientes")) ?? [];
}

export async function obtenerCliente(id) {
  return run(
    supabase.from("clinica_clientes").select(CLIENTE_SELECT).eq("id", id).single(),
    "clientes",
  );
}

/** Busca o crea tutor Aguará para que el dueño aparezca en el directorio de tutores. */
export async function asegurarTutorParaCliente(payload, { clinicaPreferidaId } = {}) {
  const nombre = String(payload.nombre_completo || "").trim();
  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const telefono = String(payload.telefono || "").trim();
  const telefonoSecundario = String(payload.telefono_secundario || "").trim() || null;
  const direccion = String(payload.direccion || "").trim() || null;
  const clinicaPreferida = clinicaPreferidaId || payload.clinica_preferida_id || null;

  if (!email) return null;
  if (!telefono || telefono.replace(/\D/g, "").length < 6) {
    throw new Error("El teléfono del dueño es obligatorio (mín. 6 dígitos) para registrarlo como tutor.");
  }

  try {
    const found = await buscarTutorPorContacto({ email, telefono });
    if (found?.tutor?.id) {
      const update = {
        nombre_completo: nombre || found.tutor.nombre_completo,
        telefono: telefono || found.tutor.telefono,
        telefono_secundario: telefonoSecundario ?? found.tutor.telefono_secundario,
        direccion: direccion ?? found.tutor.direccion,
      };
      // Solo asignar preferida si el tutor aún no tiene una.
      if (clinicaPreferida) {
        const { data: tutorRow } = await supabase
          .from("tutores")
          .select("clinica_preferida_id")
          .eq("id", found.tutor.id)
          .maybeSingle();
        if (!tutorRow?.clinica_preferida_id) {
          update.clinica_preferida_id = clinicaPreferida;
        }
      }
      await supabase.from("tutores").update(update).eq("id", found.tutor.id);
      return found.tutor.id;
    }
  } catch {
    // Si falla la RPC, intentamos crear igual abajo.
  }

  const tutor = await crearTutor({
    nombreCompleto: nombre,
    email,
    telefono,
    telefonoSecundario,
    direccion,
    clinicaPreferidaId: clinicaPreferida,
  });
  return tutor.id;
}

export async function crearCliente(clinicaId, payload) {
  const tutorId = await asegurarTutorParaCliente(payload, {
    clinicaPreferidaId: clinicaId,
  });
  return run(
    supabase
      .from("clinica_clientes")
      .insert({
        clinica_id: clinicaId,
        tutor_id: tutorId,
        nombre_completo: payload.nombre_completo.trim(),
        email: payload.email?.trim().toLowerCase() || null,
        telefono: payload.telefono?.trim() || "",
        telefono_secundario: payload.telefono_secundario?.trim() || null,
        direccion: payload.direccion?.trim() || null,
        notas: payload.notas?.trim() || null,
      })
      .select(CLIENTE_SELECT)
      .single(),
    "clientes",
  );
}

export async function actualizarCliente(id, payload) {
  return run(
    supabase
      .from("clinica_clientes")
      .update({
        nombre_completo: payload.nombre_completo.trim(),
        email: payload.email?.trim() || null,
        telefono: payload.telefono?.trim() || "",
        telefono_secundario: payload.telefono_secundario?.trim() || null,
        direccion: payload.direccion?.trim() || null,
        notas: payload.notas?.trim() || null,
      })
      .eq("id", id)
      .select(CLIENTE_SELECT)
      .single(),
    "clientes",
  );
}

const PERFIL_CAMPOS = [
  "nombre_completo",
  "telefono",
  "telefono_secundario",
  "direccion",
];

function normalizarPerfilPropuesto(payload) {
  return {
    nombre_completo: String(payload.nombre_completo || "").trim(),
    telefono: String(payload.telefono || "").trim(),
    telefono_secundario: String(payload.telefono_secundario || "").trim() || null,
    direccion: String(payload.direccion || "").trim() || null,
  };
}

function perfilCambioDiff(actual, propuesto) {
  const next = normalizarPerfilPropuesto(propuesto);
  const prev = {
    nombre_completo: actual.nombre_completo || "",
    telefono: actual.telefono || "",
    telefono_secundario: actual.telefono_secundario || null,
    direccion: actual.direccion || null,
  };
  const changed = {};
  for (const key of PERFIL_CAMPOS) {
    const a = prev[key] ?? null;
    const b = next[key] ?? null;
    if (String(a || "") !== String(b || "")) changed[key] = b;
  }
  return { prev, next, changed };
}

/**
 * Edita datos del tutor/cliente.
 * Si está vinculado a un tutor Aguará, crea solicitud pendiente (el tutor debe aceptar).
 * Si no hay tutor, actualiza solo el registro local de la clínica.
 */
export async function proponerOActualizarDatosTutor({
  clinicaId,
  clinicaNombre,
  clienteId,
  payload,
}) {
  const cliente = await obtenerCliente(clienteId);
  if (!cliente || cliente.clinica_id !== clinicaId) {
    throw new Error("Cliente no encontrado en esta clínica.");
  }

  // Notas internas: siempre locales de la clínica
  const notas = payload.notas?.trim() || null;
  if (notas !== (cliente.notas || null)) {
    await run(
      supabase.from("clinica_clientes").update({ notas }).eq("id", clienteId),
      "clientes",
    );
  }

  let tutorId = cliente.tutor_id || null;
  if (!tutorId && cliente.email) {
    const { data: tutorMatch } = await supabase
      .from("tutores")
      .select("id, nombre_completo, telefono, telefono_secundario, direccion, email")
      .eq("email", String(cliente.email).trim().toLowerCase())
      .maybeSingle();
    if (tutorMatch?.id) {
      tutorId = tutorMatch.id;
      await run(
        supabase.from("clinica_clientes").update({ tutor_id: tutorId }).eq("id", clienteId),
        "clientes",
      );
    }
  }

  if (!tutorId) {
    const updated = await actualizarCliente(clienteId, {
      ...payload,
      notas: notas ?? cliente.notas,
    });
    return { modo: "inmediato", cliente: updated, solicitud: null };
  }

  const { data: tutor, error: tutorError } = await supabase
    .from("tutores")
    .select("id, nombre_completo, telefono, telefono_secundario, direccion, email")
    .eq("id", tutorId)
    .single();
  if (tutorError || !tutor) {
    throw new Error("No se encontró el tutor vinculado.");
  }

  const { prev, next, changed } = perfilCambioDiff(tutor, payload);
  if (Object.keys(changed).length === 0) {
    return {
      modo: "sin_cambios",
      cliente: await obtenerCliente(clienteId),
      solicitud: null,
    };
  }

  // Cancelar pendientes anteriores de la misma clínica/tutor
  await supabase
    .from("tutor_perfil_solicitudes")
    .update({ estado: "rechazada", resuelto_en: new Date().toISOString() })
    .eq("tutor_id", tutorId)
    .eq("clinica_id", clinicaId)
    .eq("estado", "pendiente");

  const { data: solicitud, error: solError } = await supabase
    .from("tutor_perfil_solicitudes")
    .insert({
      clinica_id: clinicaId,
      cliente_id: clienteId,
      tutor_id: tutorId,
      datos_anteriores: prev,
      datos_propuestos: next,
      estado: "pendiente",
    })
    .select(
      "id, clinica_id, cliente_id, tutor_id, datos_anteriores, datos_propuestos, estado, creado_en",
    )
    .single();

  if (solError) {
    if (/tutor_perfil_solicitudes|schema cache|does not exist/i.test(solError.message)) {
      throw new Error(
        "Falta esquema de cambios de perfil. Ejecutá supabase/chapitas/18_tutor_cambio_perfil.sql.",
      );
    }
    throw missing(solError, "solicitudes") || new Error(solError.message);
  }

  const campos = Object.keys(changed)
    .map((k) =>
      ({
        nombre_completo: "nombre",
        telefono: "teléfono",
        telefono_secundario: "tel. secundario",
        direccion: "dirección",
      })[k],
    )
    .filter(Boolean)
    .join(", ");

  const perfilTitulo = "Cambio de datos pendiente";
  const perfilMensaje = `${clinicaNombre || "Una clínica"} propone actualizar: ${campos || "tu perfil"}. Debés aceptarlo para que se aplique.`;
  await supabase.from("tutor_notificaciones").insert({
    tutor_id: tutorId,
    tipo: "perfil_cambio",
    titulo: perfilTitulo,
    mensaje: perfilMensaje,
    solicitud_id: solicitud.id,
    leida: false,
  });
  dispatchPushNotification({
    audience: "tutor",
    audienceId: tutorId,
    title: perfilTitulo,
    body: perfilMensaje,
    url: "/tutor",
    tag: `perfil-${solicitud.id}`,
  });

  return { modo: "pendiente_tutor", cliente, solicitud };
}

export async function listarSolicitudesPerfilClinica(clinicaId, { soloPendientes = true } = {}) {
  let query = supabase
    .from("tutor_perfil_solicitudes")
    .select(
      "id, clinica_id, cliente_id, tutor_id, datos_anteriores, datos_propuestos, estado, creado_en, resuelto_en, tutores(id, nombre_completo, email)",
    )
    .eq("clinica_id", clinicaId)
    .order("creado_en", { ascending: false })
    .limit(40);
  if (soloPendientes) query = query.eq("estado", "pendiente");
  const { data, error } = await query;
  if (error) {
    if (/tutor_perfil_solicitudes|schema cache|does not exist/i.test(error.message)) return [];
    throw missing(error, "solicitudes") || new Error(error.message);
  }
  return data ?? [];
}

/* ---------- Pacientes ---------- */
const PACIENTE_SELECT =
  "id, cliente_id, nombre, especie, raza, sexo, castrado, temperamento, fecha_nacimiento, peso, color, chip, alergias, enfermedad, notas, foto_url, chapita_codigo, mascota_chapita_id, activo, creado_en, clinica_clientes(id, nombre_completo, telefono, email, tutor_id)";

const PACIENTE_SELECT_LEGACY =
  "id, cliente_id, nombre, especie, raza, sexo, castrado, temperamento, fecha_nacimiento, peso, color, chip, alergias, notas, foto_url, chapita_codigo, mascota_chapita_id, activo, creado_en, clinica_clientes(id, nombre_completo, telefono, email, tutor_id)";

async function runPacienteSelect(buildQuery) {
  const { data, error } = await buildQuery(PACIENTE_SELECT);
  if (!error) return data;
  if (/enfermedad|schema cache|does not exist/i.test(error.message || "")) {
    const legacy = await buildQuery(PACIENTE_SELECT_LEGACY);
    if (legacy.error) throw missing(legacy.error, "pacientes") || new Error(legacy.error.message);
    return legacy.data;
  }
  throw missing(error, "pacientes") || new Error(error.message);
}

export async function listarPacientes(clinicaId, q = "") {
  return (
    (await runPacienteSelect((select) => {
      let query = supabase
        .from("clinica_pacientes")
        .select(select)
        .eq("clinica_id", clinicaId)
        .eq("activo", true)
        .order("nombre");
      if (q.trim()) {
        query = query.or(
          `nombre.ilike.%${q.trim()}%,especie.ilike.%${q.trim()}%,raza.ilike.%${q.trim()}%`,
        );
      }
      return query;
    })) ?? []
  );
}

export async function listarPacientesDeCliente(clienteId) {
  return (
    (await runPacienteSelect((select) =>
      supabase
        .from("clinica_pacientes")
        .select(select)
        .eq("cliente_id", clienteId)
        .eq("activo", true)
        .order("nombre"),
    )) ?? []
  );
}

export async function obtenerPaciente(id) {
  return runPacienteSelect((select) =>
    supabase.from("clinica_pacientes").select(select).eq("id", id).single(),
  );
}

function notasPacienteDesdeForm(payload) {
  const parts = [];
  if (payload.medicacion?.trim()) parts.push(`Medicación: ${payload.medicacion.trim()}`);
  if (payload.datos_adicionales?.trim()) parts.push(payload.datos_adicionales.trim());
  if (payload.notas?.trim()) parts.push(payload.notas.trim());
  return parts.length ? parts.join("\n") : null;
}

async function insertPacienteConCompat(base) {
  let { data, error } = await supabase
    .from("clinica_pacientes")
    .insert(base)
    .select(PACIENTE_SELECT)
    .single();

  if (error && /enfermedad|schema cache|does not exist/i.test(error.message || "")) {
    const legacy = { ...base };
    if (legacy.enfermedad) {
      const pref = `Enfermedad: ${legacy.enfermedad}`;
      legacy.notas = legacy.notas ? `${pref}\n${legacy.notas}` : pref;
    }
    delete legacy.enfermedad;
    ({ data, error } = await supabase
      .from("clinica_pacientes")
      .insert(legacy)
      .select(PACIENTE_SELECT_LEGACY)
      .single());
  }

  if (error && /mascota_chapita_id|schema cache|does not exist/i.test(error.message || "")) {
    const withoutChapitaLink = { ...base };
    delete withoutChapitaLink.mascota_chapita_id;
    delete withoutChapitaLink.enfermedad;
    ({ data, error } = await supabase
      .from("clinica_pacientes")
      .insert(withoutChapitaLink)
      .select(PACIENTE_SELECT_LEGACY)
      .single());
  }

  if (error && /temperamento|castrado|schema cache|does not exist/i.test(error.message || "")) {
    const legacy = { ...base };
    delete legacy.temperamento;
    delete legacy.castrado;
    delete legacy.enfermedad;
    const legacyNotas = [
      base.castrado === true || base.castrado === false
        ? `Castrado/a: ${base.castrado ? "Sí" : "No"}`
        : null,
      base.temperamento ? `Temperamento: ${base.temperamento}` : null,
      base.enfermedad ? `Enfermedad: ${base.enfermedad}` : null,
      legacy.notas,
    ]
      .filter(Boolean)
      .join("\n");
    legacy.notas = legacyNotas || null;
    ({ data, error } = await supabase
      .from("clinica_pacientes")
      .insert(legacy)
      .select(PACIENTE_SELECT_LEGACY)
      .single());
  }

  return { data, error };
}

/**
 * Asegura una ficha en `mascotas` visible para el tutor Aguará.
 * - Si hay identificador ya activado del mismo tutor → lo reutiliza.
 * - Si el identificador está libre en inventario → lo activa para el tutor.
 * - Si el código es inválido / de otro tutor → crea mascota digital (DIG-…).
 * - Sin código → digital.
 */
async function asegurarMascotaDigitalDelTutor({ clinicaId, clienteId, payload }) {
  if (!clienteId) return null;

  const cliente = await obtenerCliente(clienteId);
  if (!cliente) return null;

  let tutorId = cliente.tutor_id || null;
  if (!tutorId && cliente.email) {
    const { data: tutorMatch } = await supabase
      .from("tutores")
      .select("id, nombre_completo, email, telefono, telefono_secundario, direccion")
      .ilike("email", String(cliente.email).trim().toLowerCase())
      .maybeSingle();
    if (tutorMatch?.id) {
      tutorId = tutorMatch.id;
      await supabase
        .from("clinica_clientes")
        .update({ tutor_id: tutorId })
        .eq("id", clienteId);
    }
  }
  if (!tutorId) return null;

  const { data: tutorRow } = await supabase
    .from("tutores")
    .select("id, nombre_completo, email, telefono, telefono_secundario, direccion")
    .eq("id", tutorId)
    .maybeSingle();
  if (!tutorRow) return null;

  const castrado =
    payload.castrado === "si" || payload.castrado === true
      ? "si"
      : payload.castrado === "no" || payload.castrado === false
        ? "no"
        : "ns";

  const tutorPayload = {
    id: tutorRow.id,
    nombre_completo: tutorRow.nombre_completo || cliente.nombre_completo,
    email: tutorRow.email || cliente.email,
    telefono: tutorRow.telefono || cliente.telefono || "",
    telefono_secundario: tutorRow.telefono_secundario || cliente.telefono_secundario || null,
  };
  const mascotaPayload = {
    nombre_mascota: payload.nombre,
    especie: payload.especie || "Perro",
    raza: payload.raza || "",
    sexo: payload.sexo || "Macho",
    castrado,
    temperamento: payload.temperamento || "Tranquilo",
    fecha_nacimiento: payload.fecha_nacimiento || "",
    peso: payload.peso ?? "",
    nro_chip: payload.nro_chip || payload.chip || "",
    enfermedad: payload.enfermedad || "",
    medicacion: payload.medicacion || "",
    datos_adicionales: payload.datos_adicionales || "",
    clinica_cabecera_id: payload.clinica_cabecera_id || clinicaId,
    clinica_ref_nombre: payload.clinica_ref_nombre || "",
    clinica_ref_direccion: payload.clinica_ref_direccion || "",
    clinica_ref_telefono: payload.clinica_ref_telefono || "",
  };

  const codigoRaw =
    String(payload.mascota_chapita_id || payload.chapita_codigo || "").trim() || null;
  const codigo = codigoRaw
    ? getCanonicalInsertChapitaId(codigoRaw) || normalizeChapitaId(codigoRaw) || codigoRaw
    : null;

  try {
    if (codigo) {
      const { data: existente } = await supabase
        .from("mascotas")
        .select("id, tutor_id")
        .eq("id", codigo)
        .maybeSingle();

      if (existente?.id) {
        if (!existente.tutor_id || existente.tutor_id === tutorId) {
          if (!existente.tutor_id) {
            await supabase
              .from("mascotas")
              .update({
                tutor_id: tutorId,
                nombre_mascota: mascotaPayload.nombre_mascota,
                especie: mascotaPayload.especie,
              })
              .eq("id", existente.id);
          }
          return existente.id;
        }
        // Identificador de otro tutor: no reutilizar; crear digital abajo.
      } else {
        const disponible = await chapitaDisponibleParaActivar(codigo);
        if (disponible.ok) {
          const activada = await crearMascotaConIdentificador(
            tutorPayload,
            disponible.id,
            mascotaPayload,
            { foto: null },
          );
          if (activada?.id && payload.foto_url) {
            await supabase
              .from("mascotas")
              .update({ foto_url: payload.foto_url })
              .eq("id", activada.id);
          }
          return activada?.id || null;
        }
        // Código inválido / no disponible → digital.
      }
    }

    const mascota = await crearMascotaSinChapita(tutorPayload, mascotaPayload, { foto: null });
    if (mascota?.id && payload.foto_url) {
      await supabase
        .from("mascotas")
        .update({ foto_url: payload.foto_url })
        .eq("id", mascota.id);
    }
    return mascota?.id || null;
  } catch (err) {
    console.error("No se pudo crear la ficha digital para el tutor:", err);
    return null;
  }
}

export async function crearPaciente(clinicaId, payload) {
  const mascotaVinculadaId = await asegurarMascotaDigitalDelTutor({
    clinicaId,
    clienteId: payload.cliente_id,
    payload,
  });
  // Preferir el id real de `mascotas` (activado o DIG-). No persistir códigos huérfanos.
  const chapitaCodigo =
    mascotaVinculadaId || String(payload.chapita_codigo || "").trim() || null;
  const mascotaChapitaId =
    mascotaVinculadaId || String(payload.mascota_chapita_id || "").trim() || null;

  const base = {
    clinica_id: clinicaId,
    cliente_id: payload.cliente_id,
    nombre: payload.nombre.trim(),
    especie: payload.especie?.trim() || "Perro",
    raza: payload.raza?.trim() || null,
    sexo: payload.sexo?.trim() || null,
    fecha_nacimiento: payload.fecha_nacimiento || null,
    peso: payload.peso === "" || payload.peso == null ? null : Number(payload.peso),
    color: payload.color?.trim() || null,
    chip: payload.chip?.trim() || payload.nro_chip?.trim() || null,
    // enfermedad ≠ alergias (antes se mezclaban)
    enfermedad: payload.enfermedad?.trim() || null,
    alergias: payload.alergias?.trim() || null,
    notas: notasPacienteDesdeForm(payload),
    foto_url: payload.foto_url || null,
    chapita_codigo: chapitaCodigo,
    mascota_chapita_id: mascotaChapitaId,
    temperamento: payload.temperamento || null,
    castrado:
      payload.castrado === "si" || payload.castrado === true
        ? true
        : payload.castrado === "no" || payload.castrado === false
          ? false
          : payload.castrado === "ns"
            ? null
            : null,
  };

  const { data, error } = await insertPacienteConCompat(base);

  if (error) {
    throw (
      (/clinica_pacientes|schema cache|does not exist/i.test(error.message)
        ? new Error("Falta el esquema de pacientes. Ejecutá supabase/chapitas/11_clinica_operativa.sql.")
        : null) || new Error(error.message || "No se pudo crear el paciente.")
    );
  }
  return data;
}

/**
 * Busca una mascota Aguará por código de identificador (T1-001, DIG-…, etc.).
 */
export async function buscarMascotaPorIdentificador(codigo) {
  const raw = String(codigo || "").trim();
  if (!raw) return null;
  const id =
    getCanonicalInsertChapitaId(raw) || normalizeChapitaId(raw) || raw.toLowerCase();
  const { data, error } = await supabase
    .from("mascotas")
    .select(
      "id, nombre_mascota, especie, raza, sexo, castrado, temperamento, fecha_nacimiento, foto_url, nro_chip, enfermedad, medicacion, tutor_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw missing(error, "mascotas") || new Error(error.message);
  return data || null;
}

/**
 * Asocia al cliente una mascota ya existente:
 * - por `pacienteId` (paciente de esta clínica → se reasigna el dueño)
 * - por `codigo` de identificador Aguará (importa / vincula como paciente)
 */
export async function asociarMascotaExistenteACliente(
  clinicaId,
  clienteId,
  { pacienteId, codigo } = {},
) {
  if (!clinicaId || !clienteId) throw new Error("Faltan clínica o cliente.");

  if (pacienteId) {
    const actual = await runPacienteSelect((select) =>
      supabase
        .from("clinica_pacientes")
        .select(select)
        .eq("id", pacienteId)
        .eq("clinica_id", clinicaId)
        .maybeSingle(),
    );
    if (!actual) {
      throw new Error("Esa mascota no pertenece a esta clínica.");
    }
    if (actual.cliente_id === clienteId) return actual;
    return runPacienteSelect((select) =>
      supabase
        .from("clinica_pacientes")
        .update({ cliente_id: clienteId, activo: true })
        .eq("id", pacienteId)
        .eq("clinica_id", clinicaId)
        .select(select)
        .single(),
    );
  }

  const mascota = await buscarMascotaPorIdentificador(codigo);
  if (!mascota) {
    throw new Error("No se encontró una mascota con ese identificador.");
  }

  const existentes =
    (await runPacienteSelect((select) =>
      supabase
        .from("clinica_pacientes")
        .select(select)
        .eq("clinica_id", clinicaId)
        .or(`mascota_chapita_id.eq.${mascota.id},chapita_codigo.eq.${mascota.id}`)
        .limit(1),
    )) || [];

  if (existentes[0]) {
    const row = existentes[0];
    if (row.cliente_id === clienteId && row.activo !== false) return row;
    return runPacienteSelect((select) =>
      supabase
        .from("clinica_pacientes")
        .update({ cliente_id: clienteId, activo: true })
        .eq("id", row.id)
        .select(select)
        .single(),
    );
  }

  return crearPaciente(clinicaId, {
    cliente_id: clienteId,
    nombre: mascota.nombre_mascota,
    especie: mascota.especie || "Perro",
    raza: mascota.raza || "",
    sexo: mascota.sexo || null,
    castrado:
      mascota.castrado === true ? "si" : mascota.castrado === false ? "no" : "ns",
    temperamento: mascota.temperamento || null,
    fecha_nacimiento: mascota.fecha_nacimiento || null,
    nro_chip: mascota.nro_chip || null,
    enfermedad: mascota.enfermedad || null,
    medicacion: mascota.medicacion || null,
    foto_url: mascota.foto_url || null,
    chapita_codigo: mascota.id,
    mascota_chapita_id: mascota.id,
  });
}

export async function actualizarPaciente(id, payload) {
  const updatePayload = {
    nombre: payload.nombre.trim(),
    especie: payload.especie?.trim() || "Canino",
    raza: payload.raza?.trim() || null,
    sexo: payload.sexo?.trim() || null,
    fecha_nacimiento: payload.fecha_nacimiento || null,
    peso: payload.peso === "" || payload.peso == null ? null : Number(payload.peso),
    color: payload.color?.trim() || null,
    chip: payload.chip?.trim() || null,
    enfermedad: payload.enfermedad?.trim() || null,
    alergias: payload.alergias?.trim() || null,
    notas: payload.notas?.trim() || null,
    chapita_codigo: payload.chapita_codigo?.trim() || null,
  };

  let { data, error } = await supabase
    .from("clinica_pacientes")
    .update(updatePayload)
    .eq("id", id)
    .select(PACIENTE_SELECT)
    .single();

  if (error && /enfermedad|schema cache|does not exist/i.test(error.message || "")) {
    delete updatePayload.enfermedad;
    ({ data, error } = await supabase
      .from("clinica_pacientes")
      .update(updatePayload)
      .eq("id", id)
      .select(PACIENTE_SELECT_LEGACY)
      .single());
  }

  if (error) throw missing(error, "pacientes") || new Error(error.message);
  return data;
}

/* ---------- Citas ---------- */
const CITA_SELECT =
  "id, clinica_id, paciente_id, cliente_id, veterinario_id, servicio_id, inicio, fin, estado, motivo, notas, creado_en, clinica_pacientes(id, nombre, especie), clinica_clientes(id, nombre_completo, telefono, email, tutor_id), clinica_veterinarios(id, nombre, color), clinica_servicios(id, nombre)";

export async function listarCitasRango(clinicaId, desdeISO, hastaISO, veterinarioId) {
  let query = supabase
    .from("clinica_citas")
    .select(CITA_SELECT)
    .eq("clinica_id", clinicaId)
    .neq("estado", "lista_espera")
    .gte("inicio", desdeISO)
    .lte("inicio", hastaISO)
    .order("inicio");
  if (veterinarioId) query = query.eq("veterinario_id", veterinarioId);
  return (await run(query, "citas")) ?? [];
}

export async function listarCitasHoy(clinicaId) {
  return listarCitasRango(clinicaId, startOfDayISO(), endOfDayISO());
}

export async function listarEspera(clinicaId) {
  // Dos queries: evita mezclar citas del día “en_espera” con lista_espera sin horario.
  const [esperaSala, lista] = await Promise.all([
    run(
      supabase
        .from("clinica_citas")
        .select(CITA_SELECT)
        .eq("clinica_id", clinicaId)
        .eq("estado", "en_espera")
        .gte("inicio", startOfDayISO())
        .lte("inicio", endOfDayISO())
        .order("inicio"),
      "citas",
    ),
    run(
      supabase
        .from("clinica_citas")
        .select(CITA_SELECT)
        .eq("clinica_id", clinicaId)
        .eq("estado", "lista_espera")
        .order("creado_en"),
      "citas",
    ),
  ]);
  return [...(esperaSala ?? []), ...(lista ?? [])];
}

export async function crearCita(clinicaId, payload) {
  const estado = payload.estado || "confirmada";
  if (estado !== "lista_espera" && payload.inicio) {
    await validarDisponibilidadVeterinario({
      clinicaId,
      veterinarioId: payload.veterinario_id,
      inicio: payload.inicio,
      requerirVeterinario: true,
    });
  }

  const created = await run(
    supabase
      .from("clinica_citas")
      .insert({
        clinica_id: clinicaId,
        paciente_id: payload.paciente_id || null,
        cliente_id: payload.cliente_id || null,
        veterinario_id: payload.veterinario_id || null,
        servicio_id: payload.servicio_id || null,
        inicio: payload.inicio || null,
        fin: payload.fin || null,
        estado,
        motivo: payload.motivo?.trim() || null,
        notas: payload.notas?.trim() || null,
      })
      .select(CITA_SELECT)
      .single(),
    "citas",
  );

  if (estado === "confirmada") {
    await notificarTutorCambioCita(created, "agendada");
  }

  return created;
}

export async function actualizarCita(id, payload) {
  const estado = payload.estado;
  const inicio = payload.inicio;
  const veterinarioId = payload.veterinario_id;
  const { data: actual } = await supabase
    .from("clinica_citas")
    .select("clinica_id, veterinario_id, inicio")
    .eq("id", id)
    .maybeSingle();

  if (estado !== "lista_espera" && inicio) {
    if (actual?.clinica_id) {
      await validarDisponibilidadVeterinario({
        clinicaId: actual.clinica_id,
        veterinarioId: veterinarioId ?? actual.veterinario_id,
        inicio,
        citaIdExcluir: id,
        requerirVeterinario: true,
      });
    }
  }

  const updated = await run(
    supabase
      .from("clinica_citas")
      .update({
        ...payload,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", id)
      .select(CITA_SELECT)
      .single(),
    "citas",
  );

  if (
    inicio &&
    actual?.inicio &&
    new Date(inicio).getTime() !== new Date(actual.inicio).getTime()
  ) {
    await notificarTutorCambioCita(updated, "reprogramada");
  }

  return updated;
}

async function resolverTutorIdDeCita(cita) {
  if (cita?.clinica_clientes?.tutor_id) return cita.clinica_clientes.tutor_id;
  if (!cita?.cliente_id) return null;
  const { data: cliente } = await supabase
    .from("clinica_clientes")
    .select("tutor_id, email")
    .eq("id", cita.cliente_id)
    .maybeSingle();
  if (cliente?.tutor_id) return cliente.tutor_id;
  const email = String(cliente?.email || "")
    .trim()
    .toLowerCase();
  if (!email) return null;
  const { data: tutor } = await supabase
    .from("tutores")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  return tutor?.id || null;
}

export async function notificarTutorCambioCita(cita, estado) {
  const tutorId = await resolverTutorIdDeCita(cita);
  if (!tutorId) return;

  const cuando = cita?.inicio ? formatDateTime(cita.inicio) : "sin horario";
  const mascota = cita?.clinica_pacientes?.nombre || "tu mascota";
  const map = {
    agendada: {
      tipo: "cita_confirmada",
      titulo: "Turno agendado",
      mensaje: `La clínica te agendó un turno para ${mascota} · ${cuando}`,
    },
    confirmada: {
      tipo: "cita_confirmada",
      titulo: "Turno confirmado",
      mensaje: `La clínica confirmó el turno de ${mascota} · ${cuando}`,
    },
    cancelada: {
      tipo: "cita_cancelada",
      titulo: "Turno cancelado",
      mensaje: `La clínica canceló el turno de ${mascota} · ${cuando}`,
    },
    reprogramada: {
      tipo: "cita_reprogramada",
      titulo: "Turno reprogramado",
      mensaje: `La clínica reprogramó el turno de ${mascota} · ${cuando}`,
    },
  };
  const payload = map[estado];
  if (!payload) return;

  const baseInsert = {
    tutor_id: tutorId,
    tipo: payload.tipo,
    titulo: payload.titulo,
    mensaje: payload.mensaje,
    leida: false,
    cita_id: cita?.id || null,
  };
  let { error } = await supabase.from("tutor_notificaciones").insert(baseInsert);
  if (error && /cita_id|schema cache|does not exist/i.test(error.message || "")) {
    delete baseInsert.cita_id;
    ({ error } = await supabase.from("tutor_notificaciones").insert(baseInsert));
  }
  if (error && !/tutor_notificaciones|schema cache|does not exist/i.test(error.message || "")) {
    console.error(error);
  } else if (!error) {
    dispatchPushNotification({
      audience: "tutor",
      audienceId: tutorId,
      title: payload.titulo,
      body: payload.mensaje,
      url: "/tutor?tab=agenda",
      tag: `cita-${payload.tipo}-${cita?.id || tutorId}`,
    });
  }
}

export async function cambiarEstadoCita(id, estado) {
  const updated = await actualizarCita(id, { estado });
  if (estado === "confirmada" || estado === "cancelada") {
    await marcarNotificacionesCitaLeidas(id);
    await notificarTutorCambioCita(updated, estado);
  }
  let consulta = null;
  if (estado === "finalizada") {
    await marcarNotificacionesCitaLeidas(id);
    try {
      consulta = await asegurarConsultaDesdeCita(updated);
    } catch (err) {
      console.error("No se pudo crear la historia clínica al finalizar la cita:", err);
    }
  }
  return { ...updated, consulta_creada: consulta };
}

/**
 * Quita de la agenda una cita ya cancelada (o no asistió) para liberar el horario.
 * No notifica de nuevo al tutor: la cancelación ya ocurrió.
 */
export async function liberarHorarioCitaCancelada(id) {
  if (!id) throw new Error("Cita inválida.");
  const { data: actual, error: readError } = await supabase
    .from("clinica_citas")
    .select("id, estado")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    throw missing(readError, "citas") || new Error(readError.message);
  }
  if (!actual) throw new Error("No se encontró la cita.");
  if (!["cancelada", "no_asistio"].includes(actual.estado)) {
    throw new Error("Solo se puede liberar el horario de citas canceladas o no asistidas.");
  }

  await marcarNotificacionesCitaLeidas(id);

  const { error } = await supabase.from("clinica_citas").delete().eq("id", id);
  if (error) {
    throw missing(error, "citas") || new Error(error.message || "No se pudo liberar el horario.");
  }
  return { ok: true, id };
}

/** HC abierta sin contenido clínico → el vet debe completarla. */
export function consultaPendienteCompletar(consulta) {
  if (!consulta || consulta.cerrada) return false;
  const filled = [
    consulta.anamnesis,
    consulta.examen_fisico,
    consulta.diagnostico,
    consulta.tratamiento,
    consulta.medicacion,
  ].some((v) => String(v || "").trim());
  return !filled;
}

/**
 * Crea (o reusa) la historia clínica vinculada a una cita finalizada,
 * marcada como abierta para que el veterinario la complete.
 */
export async function asegurarConsultaDesdeCita(cita) {
  if (!cita?.id || !cita.clinica_id || !cita.paciente_id) return null;

  const { data: existing, error: findError } = await supabase
    .from("clinica_consultas")
    .select("id")
    .eq("cita_id", cita.id)
    .maybeSingle();

  if (!findError && existing?.id) {
    return obtenerConsulta(existing.id);
  }
  if (findError && !/cita_id|schema cache|does not exist/i.test(findError.message || "")) {
    throw missing(findError, "consultas") || new Error(findError.message);
  }

  const motivoBase = String(cita.motivo || "").trim() || "Consulta";
  try {
    return await crearConsulta(cita.clinica_id, {
      paciente_id: cita.paciente_id,
      cliente_id: cita.cliente_id || cita.clinica_clientes?.id || null,
      veterinario_id: cita.veterinario_id || null,
      cita_id: cita.id,
      fecha: cita.inicio || new Date().toISOString(),
      motivo: motivoBase,
      observaciones: String(cita.notas || "").trim() || null,
    });
  } catch (err) {
    // Carrera / duplicado por cita_id: devolver la existente
    const { data: again } = await supabase
      .from("clinica_consultas")
      .select("id")
      .eq("cita_id", cita.id)
      .maybeSingle();
    if (again?.id) return obtenerConsulta(again.id);
    throw err;
  }
}

export async function listarCitasPendientes(clinicaId, { soloHorarioVigente = false } = {}) {
  const rows =
    (await run(
      supabase
        .from("clinica_citas")
        .select(CITA_SELECT)
        .eq("clinica_id", clinicaId)
        .eq("estado", "pendiente")
        .order("inicio", { ascending: true }),
      "citas",
    )) ?? [];
  if (!soloHorarioVigente) return rows;
  return rows.filter((c) => !esHorarioCitaPasado(c));
}

/** Marca leídas las notifs de citas ya finalizadas o con horario pasado. */
export async function archivarNotificacionesClinicaCitasVencidas(clinicaId) {
  if (!clinicaId) return;
  const { data: notifs, error } = await supabase
    .from("clinica_notificaciones")
    .select("id, cita_id")
    .eq("clinica_id", clinicaId)
    .eq("leida", false)
    .not("cita_id", "is", null)
    .limit(50);
  if (error) {
    if (/clinica_notificaciones|schema cache|does not exist/i.test(error.message || "")) return;
    console.error(error);
    return;
  }
  const ids = [...new Set((notifs || []).map((n) => n.cita_id).filter(Boolean))];
  if (!ids.length) return;

  const { data: citas, error: citasError } = await supabase
    .from("clinica_citas")
    .select("id, inicio, fin, estado")
    .in("id", ids);
  if (citasError) {
    console.error(citasError);
    return;
  }
  const byId = new Map((citas || []).map((c) => [c.id, c]));
  const vencidas = (notifs || [])
    .filter((n) => esNotificacionCitaVencida(byId.get(n.cita_id) || null))
    .map((n) => n.id);
  if (!vencidas.length) return;

  const { error: updError } = await supabase
    .from("clinica_notificaciones")
    .update({ leida: true })
    .in("id", vencidas);
  if (updError && !/clinica_notificaciones|schema cache|does not exist/i.test(updError.message || "")) {
    console.error(updError);
  }
}

export async function listarNotificacionesClinica(clinicaId, { soloNoLeidas = false } = {}) {
  if (soloNoLeidas) {
    await archivarNotificacionesClinicaCitasVencidas(clinicaId);
  }
  let query = supabase
    .from("clinica_notificaciones")
    .select("id, tipo, titulo, mensaje, cita_id, leida, creado_en")
    .eq("clinica_id", clinicaId)
    .order("creado_en", { ascending: false })
    .limit(30);
  if (soloNoLeidas) query = query.eq("leida", false);
  const { data, error } = await query;
  if (error) {
    if (/clinica_notificaciones|schema cache|does not exist/i.test(error.message)) {
      return [];
    }
    throw missing(error, "notificaciones") || new Error(error.message);
  }
  return data ?? [];
}

export async function marcarNotificacionLeida(id) {
  const { error } = await supabase
    .from("clinica_notificaciones")
    .update({ leida: true })
    .eq("id", id);
  if (error && !/clinica_notificaciones|schema cache|does not exist/i.test(error.message)) {
    throw missing(error, "notificaciones") || new Error(error.message);
  }
}

export async function marcarNotificacionesCitaLeidas(citaId) {
  if (!citaId) return;
  const { error } = await supabase
    .from("clinica_notificaciones")
    .update({ leida: true })
    .eq("cita_id", citaId);
  if (error && !/clinica_notificaciones|schema cache|does not exist/i.test(error.message)) {
    console.error(error);
  }
}

export async function marcarTodasNotificacionesLeidas(clinicaId) {
  const { error } = await supabase
    .from("clinica_notificaciones")
    .update({ leida: true })
    .eq("clinica_id", clinicaId)
    .eq("leida", false);
  if (error && !/clinica_notificaciones|schema cache|does not exist/i.test(error.message)) {
    throw missing(error, "notificaciones") || new Error(error.message);
  }
}

/* ---------- Consultas / HC ---------- */
const CONSULTA_SELECT =
  "id, clinica_id, paciente_id, cliente_id, veterinario_id, cita_id, fecha, motivo, anamnesis, examen_fisico, diagnostico, tratamiento, medicacion, peso, temperatura, observaciones, cerrada, firmado_por, firma_imagen, cerrado_en, creado_en, actualizado_en, clinica_pacientes(id, nombre), clinica_veterinarios(id, nombre, matricula, firma_digital), clinicas(id, nombre)";

const CONSULTA_SELECT_LEGACY =
  "id, clinica_id, paciente_id, cliente_id, veterinario_id, cita_id, fecha, motivo, anamnesis, examen_fisico, diagnostico, tratamiento, medicacion, peso, temperatura, observaciones, cerrada, firmado_por, firma_imagen, cerrado_en, creado_en, clinica_pacientes(id, nombre), clinica_veterinarios(id, nombre, matricula, firma_digital)";

async function runConsultaSelect(buildQuery) {
  const { data, error } = await buildQuery(CONSULTA_SELECT);
  if (!error) return data;
  if (/actualizado_en|schema cache/i.test(error.message)) {
    const legacy = await buildQuery(CONSULTA_SELECT_LEGACY);
    if (legacy.error) throw missing(legacy.error, "consultas") || new Error(legacy.error.message);
    return legacy.data;
  }
  throw missing(error, "consultas") || new Error(error.message);
}

/** Pacientes de cualquier clínica con la misma chapita (historial compartido). */
export async function listarPacienteIdsRelacionados(paciente) {
  const pacienteId = paciente?.id;
  if (!pacienteId) return [];
  const chapitaId = paciente.mascota_chapita_id || paciente.chapita_codigo || null;
  if (!chapitaId) return [pacienteId];

  const { data, error } = await supabase
    .from("clinica_pacientes")
    .select("id")
    .or(`mascota_chapita_id.eq.${chapitaId},chapita_codigo.eq.${chapitaId}`);

  if (error) {
    throw missing(error, "pacientes") || new Error(error.message);
  }
  const ids = [...new Set([pacienteId, ...(data || []).map((p) => p.id)])];
  return ids;
}

/** ¿El tutor autorizó a esta clínica a ver la HC completa (otras clínicas)? */
export async function clinicaTienePermisoHc(clinicaId, tutorId) {
  if (!clinicaId || !tutorId) return false;
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
    throw missing(error, "compartir") || new Error(error.message);
  }
  return Boolean(data);
}

async function tutorIdsConPermisoHc(clinicaId) {
  const { data, error } = await supabase
    .from("tutor_compartir_clinica")
    .select("tutor_id")
    .eq("clinica_id", clinicaId)
    .eq("estado", "aceptada");
  if (error) {
    if (/tutor_compartir_clinica|schema cache|does not exist/i.test(error.message)) {
      return new Set();
    }
    throw missing(error, "compartir") || new Error(error.message);
  }
  return new Set((data || []).map((r) => r.tutor_id).filter(Boolean));
}

/**
 * Historias del paciente. Con permiso activo del tutor: también otras clínicas (misma chapita).
 * Sin permiso: solo lo cargado en esta clínica (no se borra nada al revocar).
 */
export async function listarConsultasPacienteCompletas(paciente, { clinicaId } = {}) {
  const ids = await listarPacienteIdsRelacionados(paciente);
  if (!ids.length) return [];

  const tutorId = paciente.clinica_clientes?.tutor_id || null;
  let scopeIds = ids;
  if (clinicaId) {
    const shared = tutorId ? await clinicaTienePermisoHc(clinicaId, tutorId) : false;
    if (!shared) scopeIds = [paciente.id];
  }

  let builder = (select) =>
    supabase
      .from("clinica_consultas")
      .select(select)
      .in("paciente_id", scopeIds)
      .order("fecha", { ascending: false });

  if (clinicaId && scopeIds.length === 1 && scopeIds[0] === paciente.id) {
    builder = (select) =>
      supabase
        .from("clinica_consultas")
        .select(select)
        .eq("paciente_id", paciente.id)
        .eq("clinica_id", clinicaId)
        .order("fecha", { ascending: false });
  }

  const data = await runConsultaSelect(builder);
  return data ?? [];
}

export async function listarConsultas(clinicaId, { pacienteId } = {}) {
  if (pacienteId) {
    const paciente = await obtenerPaciente(pacienteId);
    return listarConsultasPacienteCompletas(paciente, { clinicaId });
  }

  const propias = await runConsultaSelect((select) =>
    supabase
      .from("clinica_consultas")
      .select(select)
      .eq("clinica_id", clinicaId)
      .order("fecha", { ascending: false }),
  );

  const permitidos = await tutorIdsConPermisoHc(clinicaId);
  if (!permitidos.size) return propias ?? [];

  const pacientes =
    (await run(
      supabase
        .from("clinica_pacientes")
        .select("id, mascota_chapita_id, chapita_codigo, clinica_clientes(tutor_id)")
        .eq("clinica_id", clinicaId)
        .eq("activo", true),
      "pacientes",
    )) ?? [];

  const conPermiso = pacientes.filter((p) =>
    permitidos.has(p.clinica_clientes?.tutor_id),
  );
  const chapitas = [
    ...new Set(
      conPermiso.flatMap((p) => [p.mascota_chapita_id, p.chapita_codigo]).filter(Boolean),
    ),
  ];
  if (!chapitas.length) return propias ?? [];

  const localIds = new Set(pacientes.map((p) => p.id));
  const orFilter = chapitas
    .map((c) => `mascota_chapita_id.eq.${c},chapita_codigo.eq.${c}`)
    .join(",");

  const { data: siblings, error: sibError } = await supabase
    .from("clinica_pacientes")
    .select("id")
    .or(orFilter);
  if (sibError) {
    throw missing(sibError, "pacientes") || new Error(sibError.message);
  }

  const relatedIds = (siblings || []).map((p) => p.id).filter((id) => !localIds.has(id));
  if (!relatedIds.length) return propias ?? [];

  const compartidas = await runConsultaSelect((select) =>
    supabase
      .from("clinica_consultas")
      .select(select)
      .in("paciente_id", relatedIds)
      .neq("clinica_id", clinicaId)
      .order("fecha", { ascending: false }),
  );

  const byId = new Map();
  for (const row of [...(propias || []), ...(compartidas || [])]) {
    byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

export async function obtenerConsulta(id) {
  return runConsultaSelect((select) =>
    supabase.from("clinica_consultas").select(select).eq("id", id).single(),
  );
}

export async function crearConsulta(clinicaId, payload) {
  return run(
    supabase
      .from("clinica_consultas")
      .insert({
        clinica_id: clinicaId,
        paciente_id: payload.paciente_id,
        cliente_id: payload.cliente_id || null,
        veterinario_id: payload.veterinario_id || null,
        cita_id: payload.cita_id || null,
        fecha: payload.fecha || new Date().toISOString(),
        motivo: payload.motivo?.trim() || null,
        anamnesis: payload.anamnesis?.trim() || null,
        examen_fisico: payload.examen_fisico?.trim() || null,
        diagnostico: payload.diagnostico?.trim() || null,
        tratamiento: payload.tratamiento?.trim() || null,
        medicacion: payload.medicacion?.trim() || null,
        peso: payload.peso === "" || payload.peso == null ? null : Number(payload.peso),
        temperatura:
          payload.temperatura === "" || payload.temperatura == null
            ? null
            : Number(payload.temperatura),
        observaciones: payload.observaciones?.trim() || null,
      })
      .select(CONSULTA_SELECT)
      .single(),
    "consultas",
  );
}

export async function actualizarConsulta(id, payload, { clinicaId } = {}) {
  if (clinicaId) {
    const actual = await obtenerConsulta(id);
    if (actual?.clinica_id && actual.clinica_id !== clinicaId) {
      throw new Error(
        "No podés editar historias clínicas de otra clínica. Solo las de tu clínica.",
      );
    }
  }

  const withStamp = {
    ...payload,
    actualizado_en: new Date().toISOString(),
  };
  let query = supabase
    .from("clinica_consultas")
    .update(withStamp)
    .eq("id", id);
  if (clinicaId) query = query.eq("clinica_id", clinicaId);

  const { data, error } = await query.select(CONSULTA_SELECT).single();

  if (error) {
    // Compat si aún no corrieron 19_consultas_actualizado.sql
    if (/actualizado_en|schema cache/i.test(error.message)) {
      let legacyQuery = supabase.from("clinica_consultas").update(payload).eq("id", id);
      if (clinicaId) legacyQuery = legacyQuery.eq("clinica_id", clinicaId);
      const { data: legacy, error: legacyError } = await legacyQuery
        .select(CONSULTA_SELECT_LEGACY)
        .single();
      if (legacyError) throw missing(legacyError, "consultas") || new Error(legacyError.message);
      return legacy;
    }
    if (/0 rows|PGRST116/i.test(error.message || "") || error.code === "PGRST116") {
      throw new Error(
        "No podés editar historias clínicas de otra clínica. Solo las de tu clínica.",
      );
    }
    throw missing(error, "consultas") || new Error(error.message);
  }
  return data;
}

export async function cerrarConsulta(id, { firmadoPor, firmaImagen, clinicaId } = {}) {
  return actualizarConsulta(
    id,
    {
      cerrada: true,
      firmado_por: firmadoPor?.trim() || "Veterinario",
      firma_imagen: firmaImagen || null,
      cerrado_en: new Date().toISOString(),
    },
    { clinicaId },
  );
}

/* ---------- Directorio tutores + compartir perfil ---------- */
/** Solo nombre del tutor + nombres de mascotas (sin contacto ni ficha clínica). */
export async function listarDirectorioTutores(clinicaId) {
  const { data: tutores, error } = await supabase
    .from("tutores")
    .select("id, nombre_completo")
    .order("nombre_completo");
  if (error) throw missing(error, "tutores") || new Error(error.message);

  const ids = (tutores || []).map((t) => t.id);
  if (!ids.length) return [];

  const { data: mascotas } = await supabase
    .from("mascotas")
    .select("id, tutor_id, nombre_mascota")
    .in("tutor_id", ids);

  let compartidos = [];
  let pacientesClinica = [];
  if (clinicaId) {
    const [{ data, error: shareError }, { data: clientes }] = await Promise.all([
      supabase
        .from("tutor_compartir_clinica")
        .select("id, tutor_id, estado, creado_en, resuelto_en")
        .eq("clinica_id", clinicaId),
      supabase
        .from("clinica_clientes")
        .select("id, tutor_id")
        .eq("clinica_id", clinicaId)
        .not("tutor_id", "is", null),
    ]);
    if (shareError && !/tutor_compartir_clinica|schema cache|does not exist/i.test(shareError.message)) {
      throw missing(shareError, "compartir") || new Error(shareError.message);
    }
    compartidos = data ?? [];

    const clienteIds = (clientes || []).map((c) => c.id);
    const tutorByCliente = new Map((clientes || []).map((c) => [c.id, c.tutor_id]));
    if (clienteIds.length) {
      const { data: pacientes } = await supabase
        .from("clinica_pacientes")
        .select("id, cliente_id, nombre, activo")
        .eq("clinica_id", clinicaId)
        .eq("activo", true)
        .in("cliente_id", clienteIds);
      pacientesClinica = (pacientes || []).map((p) => ({
        id: `pac-${p.id}`,
        tutor_id: tutorByCliente.get(p.cliente_id),
        nombre: p.nombre,
      }));
    }
  }

  const shareByTutor = new Map(compartidos.map((s) => [s.tutor_id, s]));
  const petsByTutor = new Map();
  for (const m of mascotas || []) {
    const list = petsByTutor.get(m.tutor_id) || [];
    list.push({ id: m.id, nombre: m.nombre_mascota });
    petsByTutor.set(m.tutor_id, list);
  }
  for (const p of pacientesClinica) {
    if (!p.tutor_id) continue;
    const list = petsByTutor.get(p.tutor_id) || [];
    if (list.some((x) => x.nombre?.toLowerCase() === String(p.nombre || "").toLowerCase())) {
      continue;
    }
    list.push({ id: p.id, nombre: p.nombre });
    petsByTutor.set(p.tutor_id, list);
  }

  return (tutores || []).map((t) => {
    const share = shareByTutor.get(t.id) || null;
    return {
      id: t.id,
      nombre_completo: t.nombre_completo,
      mascotas: petsByTutor.get(t.id) || [],
      compartir: share
        ? { id: share.id, estado: share.estado, creado_en: share.creado_en }
        : null,
      perfil_compartido: share?.estado === "aceptada",
    };
  });
}

export async function solicitarCompartirPerfilTutor({
  clinicaId,
  clinicaNombre,
  tutorId,
  mensaje,
}) {
  if (!clinicaId || !tutorId) throw new Error("Faltan datos de la solicitud.");

  const { data: existing } = await supabase
    .from("tutor_compartir_clinica")
    .select("id, estado")
    .eq("clinica_id", clinicaId)
    .eq("tutor_id", tutorId)
    .maybeSingle();

  if (existing?.estado === "pendiente") {
    throw new Error("Ya hay una solicitud pendiente para este tutor.");
  }
  // Si ya estaba aceptada, se puede volver a pedir para autorizar otra mascota.

  let solicitud;
  if (existing) {
    const updatePayload = {
      estado: "pendiente",
      mensaje: mensaje?.trim() || null,
      resuelto_en: null,
      creado_en: new Date().toISOString(),
      mascota_id: null,
    };
    let { data, error } = await supabase
      .from("tutor_compartir_clinica")
      .update(updatePayload)
      .eq("id", existing.id)
      .select("id, clinica_id, tutor_id, estado, mensaje, creado_en")
      .single();
    if (error && /mascota_id|schema cache|does not exist/i.test(error.message)) {
      ({ data, error } = await supabase
        .from("tutor_compartir_clinica")
        .update({
          estado: "pendiente",
          mensaje: mensaje?.trim() || null,
          resuelto_en: null,
          creado_en: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id, clinica_id, tutor_id, estado, mensaje, creado_en")
        .single());
    }
    if (error) {
      if (/tutor_compartir_clinica|schema cache|does not exist/i.test(error.message)) {
        throw new Error(
          "Falta esquema de compartir perfil. Ejecutá supabase/chapitas/21_tutor_compartir_clinica.sql.",
        );
      }
      throw missing(error, "compartir") || new Error(error.message);
    }
    solicitud = data;
  } else {
    const { data, error } = await supabase
      .from("tutor_compartir_clinica")
      .insert({
        clinica_id: clinicaId,
        tutor_id: tutorId,
        estado: "pendiente",
        mensaje: mensaje?.trim() || null,
      })
      .select("id, clinica_id, tutor_id, estado, mensaje, creado_en")
      .single();
    if (error) {
      if (/tutor_compartir_clinica|schema cache|does not exist/i.test(error.message)) {
        throw new Error(
          "Falta esquema de compartir perfil. Ejecutá supabase/chapitas/21_tutor_compartir_clinica.sql.",
        );
      }
      throw missing(error, "compartir") || new Error(error.message);
    }
    solicitud = data;
  }

  const compartirTitulo = "Solicitud para ver tu perfil";
  const compartirMensaje = `${clinicaNombre || "Una clínica"} quiere acceder a tu perfil. Debés aceptar para compartir tus datos.`;
  const { error: notifError } = await supabase.from("tutor_notificaciones").insert({
    tutor_id: tutorId,
    tipo: "compartir_perfil",
    titulo: compartirTitulo,
    mensaje: compartirMensaje,
    solicitud_id: null,
    leida: false,
  });
  if (
    notifError &&
    !/tutor_notificaciones|schema cache|does not exist/i.test(notifError.message)
  ) {
    console.error(notifError);
  } else if (!notifError) {
    dispatchPushNotification({
      audience: "tutor",
      audienceId: tutorId,
      title: compartirTitulo,
      body: compartirMensaje,
      url: "/tutor",
      tag: `compartir-${tutorId}`,
    });
  }

  return solicitud;
}

export async function obtenerPerfilTutorCompartido(clinicaId, tutorId) {
  const { data: share, error } = await supabase
    .from("tutor_compartir_clinica")
    .select("id, estado, mascota_id")
    .eq("clinica_id", clinicaId)
    .eq("tutor_id", tutorId)
    .eq("estado", "aceptada")
    .maybeSingle();
  if (error && !/tutor_compartir_clinica|schema cache|does not exist/i.test(error.message)) {
    throw missing(error, "compartir") || new Error(error.message);
  }
  if (!share) {
    throw new Error("El tutor todavía no aceptó compartir su perfil con esta clínica.");
  }

  const { data: tutor, error: tutorError } = await supabase
    .from("tutores")
    .select(
      "id, nombre_completo, email, telefono, telefono_secundario, direccion, clinica_preferida_id",
    )
    .eq("id", tutorId)
    .single();
  if (tutorError) throw missing(tutorError, "tutores") || new Error(tutorError.message);

  const { data: mascotas } = await supabase
    .from("mascotas")
    .select("id, nombre_mascota, especie, raza, sexo, fecha_nacimiento, foto_url")
    .eq("tutor_id", tutorId)
    .order("creado_en", { ascending: false });

  // Ficha completa: pacientes de esta clínica (p. ej. pedida por turno) + mascota autorizada.
  // El resto: solo nombre.
  const { data: clientes } = await supabase
    .from("clinica_clientes")
    .select("id")
    .eq("clinica_id", clinicaId)
    .eq("tutor_id", tutorId);
  const clienteIds = (clientes || []).map((c) => c.id);
  let chapitasPaciente = new Set();
  if (clienteIds.length) {
    const { data: pacientes } = await supabase
      .from("clinica_pacientes")
      .select("mascota_chapita_id, chapita_codigo")
      .eq("clinica_id", clinicaId)
      .eq("activo", true)
      .in("cliente_id", clienteIds);
    chapitasPaciente = new Set(
      (pacientes || [])
        .flatMap((p) => [p.mascota_chapita_id, p.chapita_codigo])
        .filter(Boolean),
    );
  }
  if (share.mascota_id) chapitasPaciente.add(share.mascota_id);

  const mascotasVisibles = (mascotas ?? []).map((m) => {
    if (chapitasPaciente.has(m.id)) {
      return { ...m, acceso: "completo" };
    }
    return {
      id: m.id,
      nombre_mascota: m.nombre_mascota,
      acceso: "nombre",
    };
  });

  return {
    tutor,
    mascotas: mascotasVisibles,
    compartir_id: share.id,
    mascota_autorizada_id: share.mascota_id || null,
  };
}

/* ---------- Recordatorios (tutor portal) ---------- */
function normalizeHorariosPayload(list) {
  return (Array.isArray(list) ? list : [])
    .map((h) => String(h || "").trim().slice(0, 5))
    .filter((h) => /^\d{2}:\d{2}$/.test(h));
}

export async function crearRecordatorio(clinicaId, payload) {
  const dePorVida = Boolean(payload.de_por_vida);
  return run(
    supabase
      .from("clinica_recordatorios")
      .insert({
        clinica_id: clinicaId,
        paciente_id: payload.paciente_id,
        cliente_id: payload.cliente_id || null,
        tipo: payload.tipo || "control",
        titulo: payload.titulo.trim(),
        detalle: payload.detalle?.trim() || null,
        fecha_proxima: dePorVida ? null : payload.fecha_proxima || null,
        de_por_vida: dePorVida,
        horarios: normalizeHorariosPayload(payload.horarios),
      })
      .select(
        "id, paciente_id, tipo, titulo, detalle, fecha_proxima, de_por_vida, horarios, activo",
      )
      .single(),
    "recordatorios",
  );
}

export async function listarRecordatoriosPaciente(pacienteId) {
  return (
    (await run(
      supabase
        .from("clinica_recordatorios")
        .select(
          "id, paciente_id, tipo, titulo, detalle, fecha_proxima, de_por_vida, horarios, activo, creado_en",
        )
        .eq("paciente_id", pacienteId)
        .order("creado_en", { ascending: false }),
      "recordatorios",
    )) ?? []
  );
}

export async function listarTratamientosPaciente(pacienteId) {
  return (
    (await run(
      supabase
        .from("clinica_tratamientos")
        .select(
          "id, paciente_id, titulo, detalle, fecha_inicio, fecha_fin, de_por_vida, horarios, activo, creado_en",
        )
        .eq("paciente_id", pacienteId)
        .order("fecha_inicio", { ascending: false }),
      "tratamientos",
    )) ?? []
  );
}

/* ---------- Vacunas / desparasitación / archivos ---------- */
export async function listarVacunas(pacienteId) {
  return (
    (await run(
      supabase
        .from("clinica_vacunas")
        .select("id, nombre, fecha, proxima_fecha, lote, veterinario_id, notas")
        .eq("paciente_id", pacienteId)
        .order("fecha", { ascending: false }),
      "vacunas",
    )) ?? []
  ).map((v) => ({ ...v, origen: "clinica" }));
}

/** Vacunas clínicas (+ otras clínicas si hay permiso) + las del tutor. */
export async function listarVacunasPacienteCompletas(paciente, { clinicaId } = {}) {
  const pacienteId = paciente?.id;
  if (!pacienteId) return [];

  const relatedIds = await listarPacienteIdsRelacionados(paciente);
  const tutorId = paciente.clinica_clientes?.tutor_id || null;
  let scopeIds = relatedIds;
  if (clinicaId) {
    const shared = tutorId ? await clinicaTienePermisoHc(clinicaId, tutorId) : false;
    if (!shared) scopeIds = [pacienteId];
  }

  let vacunasQuery = supabase
    .from("clinica_vacunas")
    .select("id, nombre, fecha, proxima_fecha, lote, veterinario_id, notas, paciente_id, clinica_id")
    .in("paciente_id", scopeIds)
    .order("fecha", { ascending: false });
  if (clinicaId && scopeIds.length === 1 && scopeIds[0] === pacienteId) {
    vacunasQuery = vacunasQuery.eq("clinica_id", clinicaId);
  }

  const clinicas =
    (await run(vacunasQuery, "vacunas")) ?? [];
  const clinicasTagged = clinicas.map((v) => ({ ...v, origen: "clinica" }));

  const chapitaId = paciente.mascota_chapita_id || paciente.chapita_codigo || null;

  let query = supabase
    .from("tutor_vacunas")
    .select("id, tutor_id, mascota_id, paciente_id, nombre, fecha, proxima_fecha, lote, notas, creado_en")
    .order("fecha", { ascending: false });

  if (chapitaId && tutorId) {
    query = query.or(
      `paciente_id.in.(${scopeIds.join(",")}),and(mascota_id.eq.${chapitaId},tutor_id.eq.${tutorId})`,
    );
  } else if (chapitaId) {
    query = query.or(
      `paciente_id.in.(${scopeIds.join(",")}),mascota_id.eq.${chapitaId}`,
    );
  } else {
    query = query.in("paciente_id", scopeIds);
  }

  const { data, error } = await query;
  if (error) {
    if (/tutor_vacunas|schema cache|does not exist/i.test(error.message)) {
      return clinicasTagged;
    }
    throw missing(error, "vacunas tutor") || new Error(error.message);
  }

  const tutorVacunas = (data ?? []).map((v) => ({ ...v, origen: "tutor" }));
  return [...clinicasTagged, ...tutorVacunas].sort(
    (a, b) => new Date(b.fecha) - new Date(a.fecha),
  );
}

export async function crearVacuna(clinicaId, payload) {
  const fecha = payload.fecha || new Date().toISOString().slice(0, 10);
  return run(
    supabase
      .from("clinica_vacunas")
      .insert({
        clinica_id: clinicaId,
        paciente_id: payload.paciente_id,
        nombre: payload.nombre.trim(),
        fecha,
        proxima_fecha: payload.proxima_fecha || proximaFechaDesdeAplicacion(fecha),
        lote: payload.lote?.trim() || null,
        veterinario_id: payload.veterinario_id || null,
        notas: payload.notas?.trim() || null,
      })
      .select("id, nombre, fecha, proxima_fecha, lote, veterinario_id, notas")
      .single(),
    "vacunas",
  );
}

export async function actualizarVacuna(id, payload) {
  return run(
    supabase
      .from("clinica_vacunas")
      .update({
        nombre: payload.nombre.trim(),
        fecha: payload.fecha || null,
        proxima_fecha: payload.proxima_fecha || null,
        lote: payload.lote?.trim() || null,
        notas: payload.notas?.trim() || null,
        veterinario_id: payload.veterinario_id || null,
      })
      .eq("id", id)
      .select("id, nombre, fecha, proxima_fecha, lote, veterinario_id, notas")
      .single(),
    "vacunas",
  );
}

export async function eliminarVacuna(id) {
  await run(supabase.from("clinica_vacunas").delete().eq("id", id), "vacunas");
}

export async function listarDesparasitaciones(pacienteId) {
  return (
    (await run(
      supabase
        .from("clinica_desparasitaciones")
        .select("id, producto, fecha, proxima_fecha, notas")
        .eq("paciente_id", pacienteId)
        .order("fecha", { ascending: false }),
      "desparasitaciones",
    )) ?? []
  );
}

/** Desparasitaciones del paciente (+ otras clínicas si hay permiso). */
export async function listarDesparasitacionesPacienteCompletas(paciente, { clinicaId } = {}) {
  const ids = await listarPacienteIdsRelacionados(paciente);
  if (!ids.length) return [];
  const tutorId = paciente.clinica_clientes?.tutor_id || null;
  let scopeIds = ids;
  if (clinicaId) {
    const shared = tutorId ? await clinicaTienePermisoHc(clinicaId, tutorId) : false;
    if (!shared) scopeIds = [paciente.id];
  }

  let q = supabase
    .from("clinica_desparasitaciones")
    .select("id, producto, fecha, proxima_fecha, notas, paciente_id, clinica_id")
    .in("paciente_id", scopeIds)
    .order("fecha", { ascending: false });
  if (clinicaId && scopeIds.length === 1 && scopeIds[0] === paciente.id) {
    q = q.eq("clinica_id", clinicaId);
  }
  return (await run(q, "desparasitaciones")) ?? [];
}

export async function crearDesparasitacion(clinicaId, payload) {
  return run(
    supabase
      .from("clinica_desparasitaciones")
      .insert({
        clinica_id: clinicaId,
        paciente_id: payload.paciente_id,
        producto: payload.producto.trim(),
        fecha: payload.fecha || new Date().toISOString().slice(0, 10),
        proxima_fecha: payload.proxima_fecha || null,
        notas: payload.notas?.trim() || null,
      })
      .select("id, producto, fecha, proxima_fecha, notas")
      .single(),
    "desparasitaciones",
  );
}

export async function actualizarDesparasitacion(id, payload) {
  return run(
    supabase
      .from("clinica_desparasitaciones")
      .update({
        producto: payload.producto.trim(),
        fecha: payload.fecha || null,
        proxima_fecha: payload.proxima_fecha || null,
        notas: payload.notas?.trim() || null,
      })
      .eq("id", id)
      .select("id, producto, fecha, proxima_fecha, notas")
      .single(),
    "desparasitaciones",
  );
}

export async function eliminarDesparasitacion(id) {
  await run(
    supabase.from("clinica_desparasitaciones").delete().eq("id", id),
    "desparasitaciones",
  );
}

export async function listarArchivos(pacienteId) {
  return (
    (await run(
      supabase
        .from("clinica_archivos")
        .select("id, consulta_id, nombre, tipo, url, creado_en")
        .eq("paciente_id", pacienteId)
        .order("creado_en", { ascending: false }),
      "archivos",
    )) ?? []
  );
}

/** Archivos del paciente (+ otras clínicas si hay permiso). */
export async function listarArchivosPacienteCompletas(paciente, { clinicaId } = {}) {
  const ids = await listarPacienteIdsRelacionados(paciente);
  if (!ids.length) return [];
  const tutorId = paciente.clinica_clientes?.tutor_id || null;
  let scopeIds = ids;
  if (clinicaId) {
    const shared = tutorId ? await clinicaTienePermisoHc(clinicaId, tutorId) : false;
    if (!shared) scopeIds = [paciente.id];
  }

  let q = supabase
    .from("clinica_archivos")
    .select("id, consulta_id, nombre, tipo, url, creado_en, paciente_id, clinica_id")
    .in("paciente_id", scopeIds)
    .order("creado_en", { ascending: false });
  if (clinicaId && scopeIds.length === 1 && scopeIds[0] === paciente.id) {
    q = q.eq("clinica_id", clinicaId);
  }
  return (await run(q, "archivos")) ?? [];
}

const ARCHIVO_MAX_BYTES = 20 * 1024 * 1024;

function extensionDesdeArchivo(file) {
  const fromName = String(file?.name || "")
    .split(".")
    .pop()
    ?.toLowerCase();
  if (fromName && fromName.length <= 8 && /^[a-z0-9]+$/i.test(fromName)) return fromName;
  if (file?.type === "application/pdf") return "pdf";
  if (file?.type === "image/png") return "png";
  if (file?.type === "image/webp") return "webp";
  if (file?.type === "image/jpeg") return "jpg";
  return "bin";
}

export async function subirArchivoPacienteStorage(clinicaId, pacienteId, file) {
  if (!file) throw new Error("Seleccioná un archivo.");
  if (file.size > ARCHIVO_MAX_BYTES) {
    throw new Error(`“${file.name}” supera el máximo de 20 MB.`);
  }
  const path = `${clinicaId}/${pacienteId}/${crypto.randomUUID()}.${extensionDesdeArchivo(file)}`;
  const { error: uploadError } = await supabase.storage
    .from("clinica-archivos")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) {
    throw new Error(
      /bucket not found/i.test(uploadError.message)
        ? "Falta el bucket clinica-archivos. Ejecutá supabase/chapitas/43_clinica_archivos_storage.sql."
        : uploadError.message || "No se pudo subir el archivo.",
    );
  }
  const { data } = supabase.storage.from("clinica-archivos").getPublicUrl(path);
  return data.publicUrl;
}

export async function crearArchivo(clinicaId, payload) {
  return run(
    supabase
      .from("clinica_archivos")
      .insert({
        clinica_id: clinicaId,
        paciente_id: payload.paciente_id,
        consulta_id: payload.consulta_id || null,
        nombre: payload.nombre.trim(),
        tipo: payload.tipo || "otro",
        url: payload.url.trim(),
      })
      .select("id, consulta_id, nombre, tipo, url, creado_en")
      .single(),
    "archivos",
  );
}

/** Sube uno o más archivos desde el ordenador y los registra en la ficha. */
export async function crearArchivosDesdeFiles(clinicaId, { paciente_id, consulta_id, tipo, files }) {
  const list = Array.from(files || []).filter(Boolean);
  if (!list.length) throw new Error("Seleccioná al menos un archivo.");
  const creados = [];
  for (const file of list) {
    const url = await subirArchivoPacienteStorage(clinicaId, paciente_id, file);
    const row = await crearArchivo(clinicaId, {
      paciente_id,
      consulta_id: consulta_id || null,
      nombre: file.name || "Archivo",
      tipo: tipo || "otro",
      url,
    });
    creados.push(row);
  }
  return creados;
}

export async function actualizarArchivo(id, payload) {
  return run(
    supabase
      .from("clinica_archivos")
      .update({
        nombre: payload.nombre.trim(),
        tipo: payload.tipo || "otro",
        url: payload.url.trim(),
      })
      .eq("id", id)
      .select("id, consulta_id, nombre, tipo, url, creado_en")
      .single(),
    "archivos",
  );
}

export async function eliminarArchivo(id) {
  await run(supabase.from("clinica_archivos").delete().eq("id", id), "archivos");
}

/* ---------- Pagos ---------- */
export async function listarPagos(clinicaId, { clienteId, desde, hasta } = {}) {
  let query = supabase
    .from("clinica_pagos")
    .select(
      "id, cliente_id, paciente_id, consulta_id, monto, concepto, metodo, fecha, creado_en, clinica_clientes(nombre_completo)",
    )
    .eq("clinica_id", clinicaId)
    .order("fecha", { ascending: false });
  if (clienteId) query = query.eq("cliente_id", clienteId);
  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", hasta);
  return (await run(query, "pagos")) ?? [];
}

export async function crearPago(clinicaId, payload) {
  return run(
    supabase
      .from("clinica_pagos")
      .insert({
        clinica_id: clinicaId,
        cliente_id: payload.cliente_id,
        paciente_id: payload.paciente_id || null,
        consulta_id: payload.consulta_id || null,
        monto: Number(payload.monto),
        concepto: payload.concepto?.trim() || "Consulta",
        metodo: payload.metodo || "efectivo",
        fecha: payload.fecha || new Date().toISOString().slice(0, 10),
      })
      .select(
        "id, cliente_id, paciente_id, consulta_id, monto, concepto, metodo, fecha, creado_en, clinica_clientes(nombre_completo)",
      )
      .single(),
    "pagos",
  );
}

export async function ingresosHoy(clinicaId) {
  const hoy = new Date().toISOString().slice(0, 10);
  const rows = await listarPagos(clinicaId, { desde: hoy, hasta: hoy });
  return rows.reduce((acc, row) => acc + Number(row.monto || 0), 0);
}

export async function alertasProximas(clinicaId) {
  const en5 = new Date();
  en5.setDate(en5.getDate() + 5);
  const hasta = en5.toISOString().slice(0, 10);
  const hoy = new Date().toISOString().slice(0, 10);

  const pacienteSelect =
    "clinica_pacientes(nombre, clinica_clientes(nombre_completo))";

  const [vacunas, desparas, recordatorios] = await Promise.all([
    run(
      supabase
        .from("clinica_vacunas")
        .select(`id, nombre, proxima_fecha, paciente_id, ${pacienteSelect}`)
        .eq("clinica_id", clinicaId)
        .not("proxima_fecha", "is", null)
        .gte("proxima_fecha", hoy)
        .lte("proxima_fecha", hasta)
        .order("proxima_fecha"),
      "vacunas",
    ),
    run(
      supabase
        .from("clinica_desparasitaciones")
        .select(`id, producto, proxima_fecha, paciente_id, ${pacienteSelect}`)
        .eq("clinica_id", clinicaId)
        .not("proxima_fecha", "is", null)
        .gte("proxima_fecha", hoy)
        .lte("proxima_fecha", hasta)
        .order("proxima_fecha"),
      "desparasitaciones",
    ),
    run(
      supabase
        .from("clinica_recordatorios")
        .select(
          `id, tipo, titulo, fecha_proxima, paciente_id, cliente_id, ${pacienteSelect}, clinica_clientes(nombre_completo)`,
        )
        .eq("clinica_id", clinicaId)
        .eq("activo", true)
        .not("fecha_proxima", "is", null)
        .gte("fecha_proxima", hoy)
        .lte("fecha_proxima", hasta)
        .order("fecha_proxima"),
      "recordatorios",
    ),
  ]);

  return {
    vacunas: vacunas ?? [],
    desparasitaciones: desparas ?? [],
    recordatorios: recordatorios ?? [],
  };
}
