import { supabase } from "@/lib/chapitas/supabaseClient";

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
  { id: "pendiente", label: "Pendiente" },
  { id: "confirmada", label: "Confirmada" },
  { id: "en_espera", label: "En espera" },
  { id: "en_atencion", label: "En atención" },
  { id: "finalizada", label: "Finalizada" },
  { id: "no_asistio", label: "No asistió" },
  { id: "cancelada", label: "Cancelada" },
  { id: "lista_espera", label: "Lista de espera" },
];

export function etiquetaEstado(estado) {
  return CITA_ESTADOS.find((e) => e.id === estado)?.label || estado;
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
export async function listarClientes(clinicaId, q = "") {
  let query = supabase
    .from("clinica_clientes")
    .select("id, nombre_completo, email, telefono, telefono_secundario, direccion, notas, creado_en")
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
    supabase
      .from("clinica_clientes")
      .select("id, nombre_completo, email, telefono, telefono_secundario, direccion, notas, creado_en")
      .eq("id", id)
      .single(),
    "clientes",
  );
}

export async function crearCliente(clinicaId, payload) {
  return run(
    supabase
      .from("clinica_clientes")
      .insert({
        clinica_id: clinicaId,
        nombre_completo: payload.nombre_completo.trim(),
        email: payload.email?.trim() || null,
        telefono: payload.telefono?.trim() || "",
        telefono_secundario: payload.telefono_secundario?.trim() || null,
        direccion: payload.direccion?.trim() || null,
        notas: payload.notas?.trim() || null,
      })
      .select("id, nombre_completo, email, telefono, telefono_secundario, direccion, notas, creado_en")
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
      .select("id, nombre_completo, email, telefono, telefono_secundario, direccion, notas, creado_en")
      .single(),
    "clientes",
  );
}

/* ---------- Pacientes ---------- */
const PACIENTE_SELECT =
  "id, cliente_id, nombre, especie, raza, sexo, fecha_nacimiento, peso, color, chip, alergias, notas, foto_url, chapita_codigo, activo, creado_en, clinica_clientes(id, nombre_completo, telefono, email)";

export async function listarPacientes(clinicaId, q = "") {
  let query = supabase
    .from("clinica_pacientes")
    .select(PACIENTE_SELECT)
    .eq("clinica_id", clinicaId)
    .eq("activo", true)
    .order("nombre");
  if (q.trim()) {
    query = query.or(`nombre.ilike.%${q.trim()}%,especie.ilike.%${q.trim()}%,raza.ilike.%${q.trim()}%`);
  }
  return (await run(query, "pacientes")) ?? [];
}

export async function listarPacientesDeCliente(clienteId) {
  return (
    (await run(
      supabase
        .from("clinica_pacientes")
        .select(PACIENTE_SELECT)
        .eq("cliente_id", clienteId)
        .eq("activo", true)
        .order("nombre"),
      "pacientes",
    )) ?? []
  );
}

export async function obtenerPaciente(id) {
  return run(
    supabase.from("clinica_pacientes").select(PACIENTE_SELECT).eq("id", id).single(),
    "pacientes",
  );
}

export async function crearPaciente(clinicaId, payload) {
  return run(
    supabase
      .from("clinica_pacientes")
      .insert({
        clinica_id: clinicaId,
        cliente_id: payload.cliente_id,
        nombre: payload.nombre.trim(),
        especie: payload.especie?.trim() || "Canino",
        raza: payload.raza?.trim() || null,
        sexo: payload.sexo?.trim() || null,
        fecha_nacimiento: payload.fecha_nacimiento || null,
        peso: payload.peso === "" || payload.peso == null ? null : Number(payload.peso),
        color: payload.color?.trim() || null,
        chip: payload.chip?.trim() || null,
        alergias: payload.alergias?.trim() || null,
        notas: payload.notas?.trim() || null,
        chapita_codigo: payload.chapita_codigo?.trim() || null,
      })
      .select(PACIENTE_SELECT)
      .single(),
    "pacientes",
  );
}

export async function actualizarPaciente(id, payload) {
  return run(
    supabase
      .from("clinica_pacientes")
      .update({
        nombre: payload.nombre.trim(),
        especie: payload.especie?.trim() || "Canino",
        raza: payload.raza?.trim() || null,
        sexo: payload.sexo?.trim() || null,
        fecha_nacimiento: payload.fecha_nacimiento || null,
        peso: payload.peso === "" || payload.peso == null ? null : Number(payload.peso),
        color: payload.color?.trim() || null,
        chip: payload.chip?.trim() || null,
        alergias: payload.alergias?.trim() || null,
        notas: payload.notas?.trim() || null,
        chapita_codigo: payload.chapita_codigo?.trim() || null,
      })
      .eq("id", id)
      .select(PACIENTE_SELECT)
      .single(),
    "pacientes",
  );
}

/* ---------- Citas ---------- */
const CITA_SELECT =
  "id, paciente_id, cliente_id, veterinario_id, servicio_id, inicio, fin, estado, motivo, notas, creado_en, clinica_pacientes(id, nombre, especie), clinica_clientes(id, nombre_completo, telefono), clinica_veterinarios(id, nombre, color), clinica_servicios(id, nombre)";

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
  return run(
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
        estado: payload.estado || "confirmada",
        motivo: payload.motivo?.trim() || null,
        notas: payload.notas?.trim() || null,
      })
      .select(CITA_SELECT)
      .single(),
    "citas",
  );
}

export async function actualizarCita(id, payload) {
  return run(
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
}

export async function cambiarEstadoCita(id, estado) {
  return actualizarCita(id, { estado });
}

/* ---------- Consultas / HC ---------- */
const CONSULTA_SELECT =
  "id, paciente_id, cliente_id, veterinario_id, cita_id, fecha, motivo, anamnesis, examen_fisico, diagnostico, tratamiento, medicacion, peso, temperatura, observaciones, cerrada, firmado_por, firma_imagen, cerrado_en, creado_en, clinica_pacientes(id, nombre), clinica_veterinarios(id, nombre, matricula, firma_digital)";

export async function listarConsultas(clinicaId, { pacienteId } = {}) {
  let query = supabase
    .from("clinica_consultas")
    .select(CONSULTA_SELECT)
    .eq("clinica_id", clinicaId)
    .order("fecha", { ascending: false });
  if (pacienteId) query = query.eq("paciente_id", pacienteId);
  return (await run(query, "consultas")) ?? [];
}

export async function obtenerConsulta(id) {
  return run(
    supabase.from("clinica_consultas").select(CONSULTA_SELECT).eq("id", id).single(),
    "consultas",
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

export async function actualizarConsulta(id, payload) {
  return run(
    supabase
      .from("clinica_consultas")
      .update(payload)
      .eq("id", id)
      .select(CONSULTA_SELECT)
      .single(),
    "consultas",
  );
}

export async function cerrarConsulta(id, { firmadoPor, firmaImagen } = {}) {
  return actualizarConsulta(id, {
    cerrada: true,
    firmado_por: firmadoPor?.trim() || "Veterinario",
    firma_imagen: firmaImagen || null,
    cerrado_en: new Date().toISOString(),
  });
}

/* ---------- Recordatorios (tutor portal) ---------- */
export async function crearRecordatorio(clinicaId, payload) {
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
        fecha_proxima: payload.fecha_proxima || null,
      })
      .select("id, paciente_id, tipo, titulo, detalle, fecha_proxima, activo")
      .single(),
    "recordatorios",
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
  );
}

export async function crearVacuna(clinicaId, payload) {
  return run(
    supabase
      .from("clinica_vacunas")
      .insert({
        clinica_id: clinicaId,
        paciente_id: payload.paciente_id,
        nombre: payload.nombre.trim(),
        fecha: payload.fecha || new Date().toISOString().slice(0, 10),
        proxima_fecha: payload.proxima_fecha || null,
        lote: payload.lote?.trim() || null,
        veterinario_id: payload.veterinario_id || null,
        notas: payload.notas?.trim() || null,
      })
      .select("id, nombre, fecha, proxima_fecha, lote, veterinario_id, notas")
      .single(),
    "vacunas",
  );
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
  const en30 = new Date();
  en30.setDate(en30.getDate() + 30);
  const hasta = en30.toISOString().slice(0, 10);
  const hoy = new Date().toISOString().slice(0, 10);

  const [vacunas, desparas] = await Promise.all([
    run(
      supabase
        .from("clinica_vacunas")
        .select("id, nombre, proxima_fecha, paciente_id, clinica_pacientes(nombre)")
        .eq("clinica_id", clinicaId)
        .not("proxima_fecha", "is", null)
        .gte("proxima_fecha", hoy)
        .lte("proxima_fecha", hasta)
        .order("proxima_fecha")
        .limit(10),
      "vacunas",
    ),
    run(
      supabase
        .from("clinica_desparasitaciones")
        .select("id, producto, proxima_fecha, paciente_id, clinica_pacientes(nombre)")
        .eq("clinica_id", clinicaId)
        .not("proxima_fecha", "is", null)
        .gte("proxima_fecha", hoy)
        .lte("proxima_fecha", hasta)
        .order("proxima_fecha")
        .limit(10),
      "desparasitaciones",
    ),
  ]);

  return {
    vacunas: vacunas ?? [],
    desparasitaciones: desparas ?? [],
  };
}
