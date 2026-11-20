import { supabase } from "@/lib/chapitas/supabaseClient";
import { normalizeClinicEmail } from "@/lib/chapitas/clinicSession";

function missingTableError(error, label = "clínicas") {
  if (/clinicas|clinica_|schema cache|does not exist/i.test(error?.message || "")) {
    return new Error(
      `Falta el esquema de ${label}. Ejecutá supabase/chapitas/10_clinicas.sql en Supabase.`,
    );
  }
  return null;
}

export async function crearClinica({
  nombre,
  email,
  telefono,
  direccion,
  ciudad,
  provincia,
  descripcion,
}) {
  const payload = {
    nombre: nombre.trim(),
    email: normalizeClinicEmail(email),
    telefono: telefono.trim(),
    direccion: (direccion || "").trim(),
    ciudad: (ciudad || "").trim(),
    provincia: (provincia || "Mendoza").trim(),
    descripcion: descripcion?.trim() || null,
  };

  const { data, error } = await supabase
    .from("clinicas")
    .insert(payload)
    .select(
      "id, nombre, email, telefono, direccion, ciudad, provincia, descripcion, maps_url, permite_citas_tutor",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya hay una clínica registrada con ese email.");
    }
    throw missingTableError(error) || new Error("No se pudo registrar la clínica.");
  }

  await asegurarServiciosGenerales(data.id).catch(() => null);
  return data;
}

export async function obtenerClinicaPorEmail(email) {
  const emailNorm = normalizeClinicEmail(email);
  const { data, error } = await supabase
    .from("clinicas")
    .select(
      "id, nombre, email, telefono, direccion, ciudad, provincia, descripcion, maps_url, permite_citas_tutor",
    )
    .eq("email", emailNorm)
    .maybeSingle();

  if (error) {
    throw missingTableError(error) || new Error("No se pudo buscar la clínica.");
  }
  return data;
}

export async function obtenerClinica(id) {
  const { data, error } = await supabase
    .from("clinicas")
    .select(
      "id, nombre, email, telefono, direccion, ciudad, provincia, descripcion, maps_url, permite_citas_tutor",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw missingTableError(error) || new Error("No se pudo cargar la clínica.");
  }
  return data;
}

export async function actualizarClinica(id, fields) {
  const payload = {
    ...fields,
    actualizado_en: new Date().toISOString(),
  };
  if (payload.email) payload.email = normalizeClinicEmail(payload.email);

  const { data, error } = await supabase
    .from("clinicas")
    .update(payload)
    .eq("id", id)
    .select(
      "id, nombre, email, telefono, direccion, ciudad, provincia, descripcion, maps_url, permite_citas_tutor",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya hay una clínica registrada con ese email.");
    }
    throw missingTableError(error) || new Error("No se pudo guardar la ubicación.");
  }
  return data;
}

export async function eliminarClinica(id) {
  const { error } = await supabase.from("clinicas").delete().eq("id", id);
  if (error) {
    throw (
      missingTableError(error) ||
      new Error(
        /permission|policy|RLS/i.test(error.message)
          ? "Falta permiso de borrado. Ejecutá supabase/chapitas/15_clinicas_admin_delete.sql en Supabase."
          : "No se pudo eliminar la clínica.",
      )
    );
  }
}

/** Fallback si aún no corrieron 29_servicios_generales.sql */
const SERVICIOS_GENERALES_FALLBACK = [
  {
    codigo: "consulta",
    nombre: "Consulta general",
    descripcion: "Consulta clínica de rutina.",
    orden: 10,
    activo_por_defecto: true,
  },
  {
    codigo: "control",
    nombre: "Control / seguimiento",
    descripcion: "Revisión de evolución o control post-tratamiento.",
    orden: 20,
    activo_por_defecto: true,
  },
  {
    codigo: "vacunacion",
    nombre: "Vacunación",
    descripcion:
      "Registra la vacuna en el historial y permite programar el recordatorio de refuerzo.",
    orden: 30,
    activo_por_defecto: true,
  },
  {
    codigo: "desparasitacion",
    nombre: "Desparasitación",
    descripcion: "Antiparasitarios internos o externos.",
    orden: 40,
    activo_por_defecto: true,
  },
  {
    codigo: "urgencia",
    nombre: "Urgencia",
    descripcion: "Atención de urgencia.",
    orden: 50,
    activo_por_defecto: true,
  },
  {
    codigo: "cirugia",
    nombre: "Cirugía",
    descripcion: "Procedimientos quirúrgicos.",
    orden: 60,
    activo_por_defecto: false,
  },
  {
    codigo: "castracion",
    nombre: "Castración / esterilización",
    descripcion: "Cirugía de castración o esterilización.",
    orden: 70,
    activo_por_defecto: false,
  },
  {
    codigo: "laboratorio",
    nombre: "Análisis clínicos",
    descripcion: "Laboratorio / análisis de sangre u otros.",
    orden: 80,
    activo_por_defecto: false,
  },
  {
    codigo: "ecografia",
    nombre: "Ecografía",
    descripcion: "Estudio ecográfico.",
    orden: 90,
    activo_por_defecto: false,
  },
  {
    codigo: "radiografia",
    nombre: "Radiografía",
    descripcion: "Estudio radiográfico.",
    orden: 100,
    activo_por_defecto: false,
  },
  {
    codigo: "odontologia",
    nombre: "Odontología",
    descripcion: "Limpieza o tratamientos dentales.",
    orden: 110,
    activo_por_defecto: false,
  },
  {
    codigo: "peluqueria",
    nombre: "Peluquería",
    descripcion: "Baño, corte y estética.",
    orden: 120,
    activo_por_defecto: false,
  },
  {
    codigo: "internacion",
    nombre: "Internación",
    descripcion: "Internación / hospitalización.",
    orden: 130,
    activo_por_defecto: false,
  },
  {
    codigo: "domicilio",
    nombre: "Atención a domicilio",
    descripcion: "Visita veterinaria a domicilio.",
    orden: 140,
    activo_por_defecto: false,
  },
  {
    codigo: "microchip",
    nombre: "Microchip / identificación",
    descripcion: "Colocación o lectura de microchip.",
    orden: 150,
    activo_por_defecto: false,
  },
  {
    codigo: "certificado",
    nombre: "Certificados",
    descripcion: "Aptos, certificados de salud o viaje.",
    orden: 160,
    activo_por_defecto: false,
  },
];

function normalizeNombreServicio(nombre) {
  return String(nombre || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Alias de nombres legacy → código del catálogo. */
const SERVICIO_NOMBRE_A_CODIGO = {
  consulta: "consulta",
  "consulta general": "consulta",
  "consulta clinica": "consulta",
  control: "control",
  seguimiento: "control",
  "control seguimiento": "control",
  vacunacion: "vacunacion",
  vacuna: "vacunacion",
  vacunas: "vacunacion",
  desparasitacion: "desparasitacion",
  desparasitar: "desparasitacion",
  urgencia: "urgencia",
  urgencias: "urgencia",
  cirugia: "cirugia",
  castracion: "castracion",
  esterilizacion: "castracion",
  "castracion esterilizacion": "castracion",
  laboratorio: "laboratorio",
  "analisis clinicos": "laboratorio",
  analisis: "laboratorio",
  ecografia: "ecografia",
  radiografia: "radiografia",
  rayos: "radiografia",
  odontologia: "odontologia",
  dental: "odontologia",
  peluqueria: "peluqueria",
  grooming: "peluqueria",
  banos: "peluqueria",
  internacion: "internacion",
  hospitalizacion: "internacion",
  domicilio: "domicilio",
  "atencion a domicilio": "domicilio",
  "visita a domicilio": "domicilio",
  microchip: "microchip",
  identificacion: "microchip",
  "microchip identificacion": "microchip",
  certificado: "certificado",
  certificados: "certificado",
  apto: "certificado",
};

function codigoCatalogoPorNombre(nombre, catalogo) {
  const norm = normalizeNombreServicio(nombre);
  if (!norm) return null;
  if (SERVICIO_NOMBRE_A_CODIGO[norm]) return SERVICIO_NOMBRE_A_CODIGO[norm];
  for (const g of catalogo || []) {
    if (normalizeNombreServicio(g.nombre) === norm) return g.codigo;
  }
  return null;
}

export function esServicioVacunacion(servicio) {
  if (!servicio) return false;
  const codigo = String(servicio.codigo || "").toLowerCase();
  if (codigo === "vacunacion") {
    // Solo el del catálogo, no variantes tipo "vacunacion antirrabica".
    const norm = normalizeNombreServicio(servicio.nombre);
    return !norm || norm === "vacunacion" || norm === "vacuna" || norm === "vacunas";
  }
  return codigoCatalogoPorNombre(servicio.nombre, []) === "vacunacion";
}

export function esServicioGeneral(servicio, catalogoCodigos) {
  if (!servicio) return false;
  const codigo = String(servicio.codigo || "").toLowerCase();
  if (!codigo) return false;
  if (catalogoCodigos instanceof Set) return catalogoCodigos.has(codigo);
  return SERVICIOS_GENERALES_FALLBACK.some((g) => g.codigo === codigo);
}

export async function listarServiciosGenerales() {
  const { data, error } = await supabase
    .from("servicios_generales")
    .select("codigo, nombre, descripcion, orden, activo_por_defecto")
    .order("orden", { ascending: true });

  if (error) {
    if (/servicios_generales|schema cache|does not exist/i.test(error.message)) {
      return SERVICIOS_GENERALES_FALLBACK;
    }
    throw (
      missingTableError(error, "servicios generales") ||
      new Error("No se pudo cargar el catálogo de servicios.")
    );
  }
  return data?.length ? data : SERVICIOS_GENERALES_FALLBACK;
}

async function listarServiciosRaw(clinicaId) {
  let { data, error } = await supabase
    .from("clinica_servicios")
    .select("id, nombre, descripcion, precio, activo, codigo")
    .eq("clinica_id", clinicaId)
    .order("creado_en", { ascending: true });

  if (error && /codigo|schema cache|does not exist/i.test(error.message)) {
    ({ data, error } = await supabase
      .from("clinica_servicios")
      .select("id, nombre, descripcion, precio, activo")
      .eq("clinica_id", clinicaId)
      .order("creado_en", { ascending: true }));
    if (!error) {
      return (data ?? []).map((s) => ({ ...s, codigo: null }));
    }
  }

  if (error) {
    throw missingTableError(error, "servicios") || new Error("No se pudieron cargar los servicios.");
  }
  return data ?? [];
}

function ordenarServicios(items, catalogo) {
  const orden = new Map((catalogo || []).map((g) => [g.codigo, g.orden]));
  return [...(items || [])].sort((a, b) => {
    const oa = orden.has(a.codigo) ? orden.get(a.codigo) : 1000;
    const ob = orden.has(b.codigo) ? orden.get(b.codigo) : 1000;
    if (oa !== ob) return oa - ob;
    return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
  });
}

function nombreCoincideConCatalogo(row, catalogoByCodigo) {
  const codigo = String(row.codigo || "").toLowerCase();
  const cat = catalogoByCodigo.get(codigo);
  if (!cat) return false;
  const norm = normalizeNombreServicio(row.nombre);
  const expected = normalizeNombreServicio(cat.nombre);
  if (norm === expected) return true;
  return SERVICIO_NOMBRE_A_CODIGO[norm] === codigo;
}

/**
 * Vincula servicios legacy (sin código o duplicados) al catálogo y elimina extras.
 */
async function deduplicarServiciosClinica(clinicaId, catalogo, actuales) {
  const catalogoByCodigo = new Map(
    (catalogo || []).map((g) => [String(g.codigo).toLowerCase(), g]),
  );

  // 0) Quitar / borrar mal clasificados (ej. "vacunacion antirrabica" con codigo vacunacion).
  for (const row of [...actuales]) {
    const codigo = String(row.codigo || "").toLowerCase();
    const norm = normalizeNombreServicio(row.nombre);
    const esAntirrabica =
      norm === "vacunacion antirrabica" ||
      norm === "vacuna antirrabica" ||
      norm.includes("antirrab");

    if (esAntirrabica) {
      await supabase.from("clinica_veterinario_servicios").delete().eq("servicio_id", row.id);
      await supabase.from("clinica_servicios").delete().eq("id", row.id);
      const idx = actuales.indexOf(row);
      if (idx >= 0) actuales.splice(idx, 1);
      continue;
    }

    if (codigo && catalogoByCodigo.has(codigo) && !nombreCoincideConCatalogo(row, catalogoByCodigo)) {
      // Variante propia mal etiquetada como general → vuelve a ser propio.
      await supabase.from("clinica_servicios").update({ codigo: null }).eq("id", row.id);
      row.codigo = null;
    }
  }

  // 1) Asignar codigo a filas sin código que coincidan por nombre exacto/alias.
  for (const row of actuales) {
    if (row.codigo) continue;
    const codigo = codigoCatalogoPorNombre(row.nombre, catalogo);
    if (!codigo) continue;
    const { error } = await supabase
      .from("clinica_servicios")
      .update({
        codigo,
        nombre: catalogoByCodigo.get(codigo)?.nombre || row.nombre,
      })
      .eq("id", row.id);
    if (!error) {
      row.codigo = codigo;
      if (catalogoByCodigo.get(codigo)?.nombre) {
        row.nombre = catalogoByCodigo.get(codigo).nombre;
      }
    }
  }

  // 2) Por cada código, dejar una sola fila (preferir nombre de catálogo + activa).
  const grupos = new Map();
  for (const row of actuales) {
    const codigo = String(row.codigo || "").toLowerCase();
    if (!codigo || !catalogoByCodigo.has(codigo)) continue;
    if (!grupos.has(codigo)) grupos.set(codigo, []);
    grupos.get(codigo).push(row);
  }

  for (const [, rows] of grupos) {
    if (rows.length < 2) continue;
    rows.sort((a, b) => {
      const aMatch = nombreCoincideConCatalogo(a, catalogoByCodigo) ? 0 : 1;
      const bMatch = nombreCoincideConCatalogo(b, catalogoByCodigo) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      const aActivo = a.activo === false ? 1 : 0;
      const bActivo = b.activo === false ? 1 : 0;
      if (aActivo !== bActivo) return aActivo - bActivo;
      const aPrecio = a.precio != null ? 0 : 1;
      const bPrecio = b.precio != null ? 0 : 1;
      if (aPrecio !== bPrecio) return aPrecio - bPrecio;
      return String(a.id).localeCompare(String(b.id));
    });
    const keeper = rows[0];
    const extras = rows.slice(1);
    for (const extra of extras) {
      await supabase
        .from("clinica_veterinario_servicios")
        .update({ servicio_id: keeper.id })
        .eq("servicio_id", extra.id);
      await supabase.from("clinica_veterinario_servicios").delete().eq("servicio_id", extra.id);
      await supabase.from("clinica_servicios").delete().eq("id", extra.id);
    }
  }
}

/**
 * Asegura que la clínica tenga una fila por cada servicio del catálogo general.
 * No pisa activo/precio si ya existe. Deduplica por código/nombre.
 */
export async function asegurarServiciosGenerales(clinicaId) {
  const [catalogo, iniciales] = await Promise.all([
    listarServiciosGenerales(),
    listarServiciosRaw(clinicaId),
  ]);

  await deduplicarServiciosClinica(clinicaId, catalogo, iniciales);
  const actuales = await listarServiciosRaw(clinicaId);

  const byCodigo = new Map();
  for (const s of actuales) {
    const codigo = String(s.codigo || "").toLowerCase();
    if (codigo) byCodigo.set(codigo, s);
  }

  // Vincular por nombre si aún falta el código en el mapa.
  for (const s of actuales) {
    if (s.codigo) continue;
    const codigo = codigoCatalogoPorNombre(s.nombre, catalogo);
    if (!codigo || byCodigo.has(codigo)) continue;
    await supabase
      .from("clinica_servicios")
      .update({
        codigo,
        nombre: catalogo.find((g) => g.codigo === codigo)?.nombre || s.nombre,
      })
      .eq("id", s.id);
    byCodigo.set(codigo, { ...s, codigo });
  }

  const faltantes = catalogo.filter((g) => !byCodigo.has(String(g.codigo).toLowerCase()));
  if (faltantes.length) {
    const payload = faltantes.map((g) => ({
      clinica_id: clinicaId,
      nombre: g.nombre,
      descripcion: g.descripcion || null,
      codigo: g.codigo,
      activo: g.activo_por_defecto !== false,
    }));

    let { error } = await supabase.from("clinica_servicios").insert(payload);
    if (error && /codigo|schema cache|does not exist/i.test(error.message)) {
      const vac = faltantes.find((g) => g.codigo === "vacunacion");
      if (vac && !actuales.some((s) => esServicioVacunacion(s))) {
        ({ error } = await supabase.from("clinica_servicios").insert({
          clinica_id: clinicaId,
          nombre: vac.nombre,
          descripcion: vac.descripcion || null,
          activo: true,
        }));
      } else {
        error = null;
      }
    }
    if (error && /duplicate|unique|23505/i.test(error.message || "")) {
      error = null;
    }
    if (error) {
      throw (
        missingTableError(error, "servicios") ||
        new Error("No se pudieron sincronizar los servicios generales.")
      );
    }
  }

  const finalRows = await listarServiciosRaw(clinicaId);
  await deduplicarServiciosClinica(clinicaId, catalogo, finalRows);
  return ordenarServicios(await listarServiciosRaw(clinicaId), catalogo);
}

/** @deprecated usar asegurarServiciosGenerales */
export async function asegurarServicioVacunacion(clinicaId) {
  const rows = await asegurarServiciosGenerales(clinicaId);
  return rows.find((s) => esServicioVacunacion(s)) || null;
}

export async function listarServicios(clinicaId) {
  return asegurarServiciosGenerales(clinicaId).catch(async () => listarServiciosRaw(clinicaId));
}

/** Solo los que la clínica ofrece (activo). Para citas / agenda. */
export async function listarServiciosActivos(clinicaId) {
  const rows = await listarServicios(clinicaId);
  return rows.filter((s) => s.activo !== false);
}

export async function crearServicio(clinicaId, { nombre, descripcion, precio, codigo }) {
  const payload = {
    clinica_id: clinicaId,
    nombre: nombre.trim(),
    descripcion: descripcion?.trim() || null,
    precio: precio === "" || precio == null ? null : Number(precio),
    codigo: codigo?.trim() || null,
    activo: true,
  };

  let { data, error } = await supabase
    .from("clinica_servicios")
    .insert(payload)
    .select("id, nombre, descripcion, precio, activo, codigo")
    .single();

  if (error && /codigo|schema cache|does not exist/i.test(error.message)) {
    delete payload.codigo;
    ({ data, error } = await supabase
      .from("clinica_servicios")
      .insert(payload)
      .select("id, nombre, descripcion, precio, activo")
      .single());
  }

  if (error) {
    throw missingTableError(error, "servicios") || new Error("No se pudo agregar el servicio.");
  }
  return data;
}

export async function actualizarServicio(id, fields) {
  const payload = {};
  if (fields.activo != null) payload.activo = Boolean(fields.activo);
  if (fields.precio !== undefined) {
    payload.precio = fields.precio === "" || fields.precio == null ? null : Number(fields.precio);
  }
  if (fields.descripcion !== undefined) {
    payload.descripcion = fields.descripcion?.trim() || null;
  }
  if (fields.nombre != null) payload.nombre = String(fields.nombre).trim();

  let { data, error } = await supabase
    .from("clinica_servicios")
    .update(payload)
    .eq("id", id)
    .select("id, nombre, descripcion, precio, activo, codigo")
    .single();

  if (error && /codigo|schema cache|does not exist/i.test(error.message)) {
    ({ data, error } = await supabase
      .from("clinica_servicios")
      .update(payload)
      .eq("id", id)
      .select("id, nombre, descripcion, precio, activo")
      .single());
  }

  if (error) {
    throw missingTableError(error, "servicios") || new Error("No se pudo actualizar el servicio.");
  }
  return data;
}

export async function eliminarServicio(id) {
  const { data: row } = await supabase
    .from("clinica_servicios")
    .select("id, codigo")
    .eq("id", id)
    .maybeSingle();

  if (row?.codigo && esServicioGeneral({ codigo: row.codigo })) {
    throw new Error(
      "Los servicios generales no se eliminan: desactivá la opción “Lo ofrecemos”.",
    );
  }

  const { error } = await supabase.from("clinica_servicios").delete().eq("id", id);
  if (error) {
    throw missingTableError(error, "servicios") || new Error("No se pudo eliminar el servicio.");
  }
}

export async function listarHorarios(clinicaId, { veterinarioId } = {}) {
  let query = supabase
    .from("clinica_horarios")
    .select(
      "id, dia_semana, hora_inicio, hora_fin, activo, veterinario_id, clinica_veterinarios(id, nombre)",
    )
    .eq("clinica_id", clinicaId)
    .order("dia_semana", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (veterinarioId) query = query.eq("veterinario_id", veterinarioId);

  const { data, error } = await query;

  if (error) {
    // Compat: si aún no corrieron 17_veterinario_horarios.sql
    if (/veterinario_id|schema cache|does not exist/i.test(error.message)) {
      const legacy = await supabase
        .from("clinica_horarios")
        .select("id, dia_semana, hora_inicio, hora_fin, activo")
        .eq("clinica_id", clinicaId)
        .order("dia_semana", { ascending: true })
        .order("hora_inicio", { ascending: true });
      if (legacy.error) {
        throw (
          missingTableError(legacy.error, "horarios") ||
          new Error("No se pudieron cargar los horarios.")
        );
      }
      return (legacy.data ?? []).map((h) => ({ ...h, veterinario_id: null }));
    }
    throw missingTableError(error, "horarios") || new Error("No se pudieron cargar los horarios.");
  }
  return data ?? [];
}

export async function crearHorario(clinicaId, { diaSemana, horaInicio, horaFin, veterinarioId }) {
  // veterinarioId null/undefined/"" = horario de apertura del local
  const vetId = veterinarioId || null;
  const { data, error } = await supabase
    .from("clinica_horarios")
    .insert({
      clinica_id: clinicaId,
      veterinario_id: vetId,
      dia_semana: Number(diaSemana),
      hora_inicio: horaInicio,
      hora_fin: horaFin,
    })
    .select(
      "id, dia_semana, hora_inicio, hora_fin, activo, veterinario_id, clinica_veterinarios(id, nombre)",
    )
    .single();

  if (error) {
    if (/veterinario_id|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Falta esquema de horarios por veterinario. Ejecutá supabase/chapitas/17_veterinario_horarios.sql.",
      );
    }
    throw missingTableError(error, "horarios") || new Error("No se pudo guardar el horario.");
  }
  return data;
}

export async function listarServiciosDeVeterinario(veterinarioId) {
  if (!veterinarioId) return [];
  const { data, error } = await supabase
    .from("clinica_veterinario_servicios")
    .select("servicio_id, clinica_servicios(id, nombre, descripcion, precio, activo, codigo)")
    .eq("veterinario_id", veterinarioId);
  if (error) {
    if (/clinica_veterinario_servicios|schema cache|does not exist/i.test(error.message)) {
      return [];
    }
    throw (
      missingTableError(error, "servicios del veterinario") ||
      new Error("No se pudieron cargar los servicios del veterinario.")
    );
  }
  return (data || [])
    .map((row) => row.clinica_servicios)
    .filter((s) => s && s.activo !== false);
}

export async function listarIdsServiciosDeVeterinario(veterinarioId) {
  if (!veterinarioId) return [];
  const { data, error } = await supabase
    .from("clinica_veterinario_servicios")
    .select("servicio_id")
    .eq("veterinario_id", veterinarioId);
  if (error) {
    if (/clinica_veterinario_servicios|schema cache|does not exist/i.test(error.message)) {
      return [];
    }
    throw (
      missingTableError(error, "servicios del veterinario") ||
      new Error("No se pudieron cargar los servicios del veterinario.")
    );
  }
  return (data || []).map((r) => r.servicio_id);
}

/** Reemplaza los servicios asociados al veterinario. */
export async function guardarServiciosDeVeterinario(veterinarioId, servicioIds) {
  if (!veterinarioId) throw new Error("Falta el veterinario.");
  const ids = [...new Set((servicioIds || []).filter(Boolean))];

  const { error: delError } = await supabase
    .from("clinica_veterinario_servicios")
    .delete()
    .eq("veterinario_id", veterinarioId);
  if (delError) {
    if (/clinica_veterinario_servicios|schema cache|does not exist/i.test(delError.message)) {
      throw new Error(
        "Falta esquema de servicios por veterinario. Ejecutá supabase/chapitas/28_clinica_horario_vet_servicios.sql.",
      );
    }
    throw (
      missingTableError(delError, "servicios del veterinario") ||
      new Error("No se pudieron actualizar los servicios del veterinario.")
    );
  }

  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("clinica_veterinario_servicios")
    .insert(ids.map((servicio_id) => ({ veterinario_id: veterinarioId, servicio_id })))
    .select("servicio_id");
  if (error) {
    throw (
      missingTableError(error, "servicios del veterinario") ||
      new Error("No se pudieron guardar los servicios del veterinario.")
    );
  }
  return data ?? [];
}

export async function eliminarHorario(id) {
  const { error } = await supabase.from("clinica_horarios").delete().eq("id", id);
  if (error) {
    throw missingTableError(error, "horarios") || new Error("No se pudo eliminar el horario.");
  }
}

export async function listarProductos(clinicaId) {
  const { data, error } = await supabase
    .from("clinica_productos")
    .select("id, nombre, descripcion, stock, unidad, precio, activo")
    .eq("clinica_id", clinicaId)
    .order("nombre", { ascending: true });

  if (error) {
    throw missingTableError(error, "productos") || new Error("No se pudo cargar el stock.");
  }
  return data ?? [];
}

export async function crearProducto(clinicaId, { nombre, descripcion, stock, unidad, precio }) {
  const { data, error } = await supabase
    .from("clinica_productos")
    .insert({
      clinica_id: clinicaId,
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      stock: Number(stock) || 0,
      unidad: (unidad || "u").trim(),
      precio: precio === "" || precio == null ? null : Number(precio),
    })
    .select("id, nombre, descripcion, stock, unidad, precio, activo")
    .single();

  if (error) {
    throw missingTableError(error, "productos") || new Error("No se pudo agregar el producto.");
  }
  return data;
}

export async function actualizarStockProducto(id, stock) {
  const { data, error } = await supabase
    .from("clinica_productos")
    .update({ stock: Math.max(0, Number(stock) || 0) })
    .eq("id", id)
    .select("id, nombre, descripcion, stock, unidad, precio, activo")
    .single();

  if (error) {
    throw missingTableError(error, "productos") || new Error("No se pudo actualizar el stock.");
  }
  return data;
}

export async function eliminarProducto(id) {
  const { error } = await supabase.from("clinica_productos").delete().eq("id", id);
  if (error) {
    throw missingTableError(error, "productos") || new Error("No se pudo eliminar el producto.");
  }
}

export const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
