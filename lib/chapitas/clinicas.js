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
    throw missingTableError(error) || new Error("No se pudo guardar la ubicación.");
  }
  return data;
}

export async function listarServicios(clinicaId) {
  const { data, error } = await supabase
    .from("clinica_servicios")
    .select("id, nombre, descripcion, precio, activo")
    .eq("clinica_id", clinicaId)
    .order("creado_en", { ascending: true });

  if (error) {
    throw missingTableError(error, "servicios") || new Error("No se pudieron cargar los servicios.");
  }
  return data ?? [];
}

export async function crearServicio(clinicaId, { nombre, descripcion, precio }) {
  const { data, error } = await supabase
    .from("clinica_servicios")
    .insert({
      clinica_id: clinicaId,
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      precio: precio === "" || precio == null ? null : Number(precio),
    })
    .select("id, nombre, descripcion, precio, activo")
    .single();

  if (error) {
    throw missingTableError(error, "servicios") || new Error("No se pudo agregar el servicio.");
  }
  return data;
}

export async function eliminarServicio(id) {
  const { error } = await supabase.from("clinica_servicios").delete().eq("id", id);
  if (error) {
    throw missingTableError(error, "servicios") || new Error("No se pudo eliminar el servicio.");
  }
}

export async function listarHorarios(clinicaId) {
  const { data, error } = await supabase
    .from("clinica_horarios")
    .select("id, dia_semana, hora_inicio, hora_fin, activo")
    .eq("clinica_id", clinicaId)
    .order("dia_semana", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (error) {
    throw missingTableError(error, "horarios") || new Error("No se pudieron cargar los horarios.");
  }
  return data ?? [];
}

export async function crearHorario(clinicaId, { diaSemana, horaInicio, horaFin }) {
  const { data, error } = await supabase
    .from("clinica_horarios")
    .insert({
      clinica_id: clinicaId,
      dia_semana: Number(diaSemana),
      hora_inicio: horaInicio,
      hora_fin: horaFin,
    })
    .select("id, dia_semana, hora_inicio, hora_fin, activo")
    .single();

  if (error) {
    throw missingTableError(error, "horarios") || new Error("No se pudo guardar el horario.");
  }
  return data;
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
