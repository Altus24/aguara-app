import { generateChapitaQrSvg } from "@/lib/chapitas/chapitaQr";
import {
  getCanonicalInsertChapitaId,
  isDigitalMascotaId,
  newDigitalMascotaId,
  normalizeChapitaId,
} from "@/lib/chapitas/chapitaId";
import { supabase } from "@/lib/chapitas/supabaseClient";

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

async function uploadFotoMascota(mascotaId, file) {
  if (!file) return null;
  if (!PHOTO_TYPES.has(file.type)) {
    throw new Error("La foto tiene que ser JPG, PNG o WebP.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("La foto no puede superar 4 MB.");
  }
  const extension =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${mascotaId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("mascotas-fotos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    throw new Error(
      /bucket not found/i.test(error.message)
        ? "Falta el bucket mascotas-fotos. Ejecutá supabase/chapitas/07_mascotas_ficha_extendida.sql."
        : "No se pudo subir la foto.",
    );
  }
  const { data } = supabase.storage.from("mascotas-fotos").getPublicUrl(path);
  return data.publicUrl;
}

function buildMascotaRow(tutor, payload, { id, fotoUrl = null, qrSvg = null } = {}) {
  return {
    id,
    tutor_id: tutor.id,
    nombre_mascota: String(payload.nombre_mascota || "").trim(),
    especie: payload.especie,
    raza: String(payload.raza || "").trim() || null,
    sexo: payload.sexo,
    castrado:
      payload.castrado === "si" ? true : payload.castrado === "no" ? false : null,
    temperamento: payload.temperamento || null,
    fecha_nacimiento: payload.fecha_nacimiento || null,
    peso: payload.peso === "" || payload.peso == null ? null : Number(payload.peso),
    nro_chip: String(payload.nro_chip || "").trim() || null,
    enfermedad: String(payload.enfermedad || "").trim() || null,
    medicacion: String(payload.medicacion || "").trim() || null,
    datos_adicionales: String(payload.datos_adicionales || "").trim() || null,
    clinica_cabecera_id: payload.clinica_cabecera_id || null,
    clinica_ref_nombre: String(payload.clinica_ref_nombre || "").trim() || null,
    clinica_ref_direccion: String(payload.clinica_ref_direccion || "").trim() || null,
    clinica_ref_telefono: String(payload.clinica_ref_telefono || "").trim() || null,
    foto_url: fotoUrl,
    nombre_dueno: tutor.nombre_completo || "",
    email_tutor: tutor.email || "",
    telefono_contacto: tutor.telefono || "",
    telefono_secundario: tutor.telefono_secundario || null,
    qr_svg: qrSvg,
  };
}

async function insertMascotaRow(row) {
  const hasClinicaRef = Boolean(
    row.clinica_ref_nombre || row.clinica_ref_direccion || row.clinica_ref_telefono,
  );

  let { data, error } = await supabase.from("mascotas").insert(row).select().single();

  if (error && /temperamento/i.test(error.message || "")) {
    delete row.temperamento;
    ({ data, error } = await supabase.from("mascotas").insert(row).select().single());
  }

  if (error && /clinica_ref_/i.test(error.message || "")) {
    if (hasClinicaRef) {
      throw new Error(
        "Faltan las columnas de clínica de referencia. Ejecutá supabase/chapitas/38_mascota_clinica_referencia.sql en Supabase y recargá el schema.",
      );
    }
    delete row.clinica_ref_nombre;
    delete row.clinica_ref_direccion;
    delete row.clinica_ref_telefono;
    ({ data, error } = await supabase.from("mascotas").insert(row).select().single());
  }

  if (error && /clinica_cabecera/i.test(error.message || "")) {
    delete row.clinica_cabecera_id;
    ({ data, error } = await supabase.from("mascotas").insert(row).select().single());
  }

  if (error && /fecha_nacimiento|peso/i.test(error.message || "")) {
    delete row.fecha_nacimiento;
    delete row.peso;
    ({ data, error } = await supabase.from("mascotas").insert(row).select().single());
  }

  if (error) {
    if (/DIG-|mascotas_id_check|check constraint/i.test(error.message || "")) {
      throw new Error(
        "Falta habilitar mascotas digitales. Ejecutá supabase/chapitas/31_mascota_digital_vincular_chapita.sql.",
      );
    }
    throw new Error(error.message || "No se pudo crear la mascota.");
  }
  return data;
}

/**
 * Crea una mascota del tutor sin identificador físico (id DIG-…).
 */
export async function crearMascotaSinChapita(tutor, payload, { foto } = {}) {
  if (!tutor?.id) throw new Error("Sesión de tutor inválida.");
  const nombre = String(payload.nombre_mascota || "").trim();
  if (!nombre) throw new Error("Ingresá el nombre de la mascota.");
  if (!payload.especie) throw new Error("Elegí la especie.");
  if (!payload.sexo) throw new Error("Elegí el sexo.");
  if (payload.castrado !== "si" && payload.castrado !== "no" && payload.castrado !== "ns") {
    throw new Error("Indicá si está castrado/a.");
  }
  if (!payload.temperamento) {
    throw new Error("Indicá el temperamento.");
  }

  const id = newDigitalMascotaId();
  const fotoUrl = await uploadFotoMascota(id, foto || null);
  const row = buildMascotaRow(tutor, payload, { id, fotoUrl, qrSvg: null });
  return insertMascotaRow(row);
}

/**
 * Activa un identificador físico disponible y crea la ficha de mascota para el tutor.
 */
export async function crearMascotaConIdentificador(tutor, chapitaId, payload, { foto } = {}) {
  if (!tutor?.id) throw new Error("Sesión de tutor inválida.");
  const disponible = await chapitaDisponibleParaActivar(chapitaId);
  if (!disponible.ok) throw new Error(disponible.message || "Identificador no disponible.");

  const id = disponible.id;
  const fotoUrl = await uploadFotoMascota(id, foto || null);
  let qrSvg = null;
  try {
    qrSvg = await generateChapitaQrSvg(id);
  } catch {
    qrSvg = null;
  }
  const row = buildMascotaRow(tutor, payload, { id, fotoUrl, qrSvg });
  return insertMascotaRow(row);
}

export async function chapitaDisponibleParaActivar(chapitaCodigo) {
  const id = getCanonicalInsertChapitaId(chapitaCodigo) || normalizeChapitaId(chapitaCodigo);
  if (!id || isDigitalMascotaId(id)) {
    return { ok: false, id: null, message: "Código de identificador no válido." };
  }

  const { data, error } = await supabase.rpc("chapita_disponible_para_activar", {
    p_chapita_id: id,
  });

  if (error) {
    if (/chapita_disponible_para_activar|schema cache|does not exist/i.test(error.message)) {
      // Fallback sin RPC: inventario chapitas + no activada en mascotas.
      const { data: existente } = await supabase
        .from("mascotas")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (existente) {
        return { ok: false, id, message: "Ese identificador ya está activado." };
      }
      const { data: enInventario } = await supabase
        .from("chapitas")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (enInventario?.id) {
        return { ok: true, id, message: "" };
      }
      return {
        ok: false,
        id,
        message: "Ese identificador no está en inventario o no es válido.",
      };
    }
    return { ok: false, id, message: error.message };
  }

  if (!data) {
    return {
      ok: false,
      id,
      message: "Ese identificador no está disponible (ya usado o no registrado en inventario).",
    };
  }
  return { ok: true, id, message: "" };
}

/**
 * Vincula un identificador físico a una mascota digital del tutor.
 * Migra el id DIG-… → código de identificador.
 */
export async function vincularChapitaAMascotaDigital({
  tutorId,
  mascotaDigitalId,
  chapitaCodigo,
}) {
  if (!tutorId) throw new Error("Sesión de tutor inválida.");
  if (!isDigitalMascotaId(mascotaDigitalId)) {
    throw new Error("Solo se pueden vincular identificadores a mascotas sin identificador.");
  }

  const disponible = await chapitaDisponibleParaActivar(chapitaCodigo);
  if (!disponible.ok) throw new Error(disponible.message);

  const { data, error } = await supabase.rpc("vincular_chapita_a_mascota_digital", {
    p_tutor_id: tutorId,
    p_mascota_digital_id: mascotaDigitalId,
    p_chapita_id: disponible.id,
  });

  if (error) {
    if (/vincular_chapita_a_mascota_digital|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "Falta la función de vínculo. Ejecutá supabase/chapitas/31_mascota_digital_vincular_chapita.sql.",
      );
    }
    throw new Error(error.message || "No se pudo vincular el identificador.");
  }

  // Generar QR de la chapita física (best-effort).
  try {
    const qrSvg = await generateChapitaQrSvg(disponible.id);
    await supabase.from("mascotas").update({ qr_svg: qrSvg }).eq("id", disponible.id);
  } catch {
    /* ignore */
  }

  // Migrar tratamientos / recordatorios del tutor DIG- → chapita.
  try {
    await supabase
      .from("tutor_tratamientos")
      .update({ mascota_id: disponible.id })
      .eq("mascota_id", mascotaDigitalId);
  } catch {
    /* ignore */
  }
  try {
    await supabase
      .from("tutor_recordatorios")
      .update({ mascota_id: disponible.id })
      .eq("mascota_id", mascotaDigitalId);
  } catch {
    /* ignore */
  }

  return { ...(data || {}), chapita_id: disponible.id };
}
