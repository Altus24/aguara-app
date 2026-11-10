import { supabase } from "@/lib/chapitas/supabaseClient";

export function normalizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export async function buscarTutorPorContacto({ email, telefono }) {
  const { data, error } = await supabase.rpc("buscar_tutor_por_contacto", {
    p_email: email?.trim() || null,
    p_telefono: telefono?.trim() || null,
  });

  if (error) {
    throw new Error(
      /buscar_tutor_por_contacto|schema cache|does not exist/i.test(error.message)
        ? "Falta la tabla de tutores. Ejecutá supabase/chapitas/09_tutores.sql en Supabase."
        : "No se pudo buscar el tutor. Intentá de nuevo.",
    );
  }

  return {
    tutor: data?.tutor ?? null,
    mascotas: Array.isArray(data?.mascotas) ? data.mascotas : [],
  };
}

export async function crearTutor({
  nombreCompleto,
  email,
  telefono,
  telefonoSecundario,
}) {
  const payload = {
    nombre_completo: nombreCompleto.trim(),
    email: email.trim().toLowerCase(),
    telefono: telefono.trim(),
    telefono_secundario: telefonoSecundario?.trim() || null,
  };

  const { data, error } = await supabase
    .from("tutores")
    .insert(payload)
    .select("id, nombre_completo, email, telefono, telefono_secundario")
    .single();

  if (error) {
    if (error.code === "23505") {
      const found = await buscarTutorPorContacto({
        email: payload.email,
        telefono: payload.telefono,
      });
      if (found.tutor) return found.tutor;
      throw new Error("Ese email ya está registrado como tutor.");
    }
    if (/tutores|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Falta la tabla de tutores. Ejecutá supabase/chapitas/09_tutores.sql en Supabase.",
      );
    }
    throw new Error("No se pudo guardar el tutor.");
  }

  return data;
}

export async function listarMascotasDelTutor(tutorId) {
  if (!tutorId) return [];
  const { data, error } = await supabase
    .from("mascotas")
    .select("id, nombre_mascota, especie, foto_url")
    .eq("tutor_id", tutorId)
    .order("creado_en", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}
