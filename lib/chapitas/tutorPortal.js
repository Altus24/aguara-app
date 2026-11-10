import { supabase } from "@/lib/chapitas/supabaseClient";
import { etiquetaEstado } from "@/lib/chapitas/clinicaOps";

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
  return (
    (await run(
      supabase
        .from("clinicas")
        .select("id, nombre, ciudad, direccion, telefono, permite_citas_tutor")
        .order("nombre"),
      "clinicas",
    )) ?? []
  );
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

export async function reprogramarCitaTutor(id, { inicio, fin, motivo, notas }) {
  return run(
    supabase
      .from("clinica_citas")
      .update({
        inicio,
        fin: fin || null,
        motivo: motivo?.trim() || null,
        notas: notas?.trim() || null,
        estado: "pendiente",
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", id)
      .select(CITA_SELECT)
      .single(),
    "citas",
  );
}

/* ---------- Historial clínico ---------- */
export async function historialClinicoTutor(tutorId, email) {
  const { mascotas, clientes } = await listarMascotasTutorCompletas(tutorId, email);
  const pacienteIds = mascotas.map((m) => m.paciente_clinico_id).filter(Boolean);
  if (!pacienteIds.length) {
    return { mascotas, consultas: [], vacunas: [], desparasitaciones: [], archivos: [], recordatorios: [] };
  }

  const [consultas, vacunas, desparasitaciones, archivos, recordatorios] = await Promise.all([
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
        .select("id, paciente_id, tipo, titulo, detalle, fecha_proxima, activo, clinica_pacientes(nombre)")
        .in("paciente_id", pacienteIds)
        .eq("activo", true)
        .order("fecha_proxima", { ascending: true }),
      "recordatorios",
    ),
  ]);

  return {
    mascotas,
    clientes,
    consultas: consultas ?? [],
    vacunas: vacunas ?? [],
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
