import { supabase } from "@/lib/chapitas/supabaseClient";
import { calcEdad } from "@/lib/chapitas/tutorPortal";

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

function missing(error) {
  if (/mascotas|clinica_|schema cache|does not exist/i.test(error?.message || "")) {
    return new Error(
      "Falta el esquema clínico de mascota. Ejecutá supabase/chapitas/14_mascota_perfil_clinico.sql en Supabase.",
    );
  }
  return null;
}

async function run(query) {
  const { data, error } = await query;
  if (error) throw missing(error) || new Error(error.message);
  return data;
}

async function uploadFotoMascota(mascotaId, file) {
  if (!file) throw new Error("Elegí una foto.");
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

/** Actualiza la foto de perfil de la mascota (y fichas clínicas con la misma chapita). */
export async function actualizarFotoMascota(chapitaId, file) {
  if (!chapitaId) throw new Error("Falta la mascota.");
  const fotoUrl = await uploadFotoMascota(chapitaId, file);
  const { data, error } = await supabase
    .from("mascotas")
    .update({ foto_url: fotoUrl })
    .eq("id", chapitaId)
    .select("id, foto_url")
    .single();
  if (error) throw missing(error) || new Error(error.message);

  // Best-effort: alinear foto en pacientes clínicos vinculados a la chapita.
  const { error: syncError } = await supabase
    .from("clinica_pacientes")
    .update({ foto_url: fotoUrl })
    .or(`mascota_chapita_id.eq.${chapitaId},chapita_codigo.eq.${chapitaId}`);
  if (syncError && !/clinica_pacientes|schema cache|does not exist/i.test(syncError.message || "")) {
    console.error(syncError);
  }

  return data;
}

export async function actualizarDatosBasicosMascota(
  chapitaId,
  { fecha_nacimiento, peso, castrado, temperamento, clinica_cabecera_id },
) {
  const payload = {
    fecha_nacimiento: fecha_nacimiento || null,
    peso: peso === "" || peso == null ? null : Number(peso),
  };
  if (castrado === "si" || castrado === true) payload.castrado = true;
  else if (castrado === "no" || castrado === false) payload.castrado = false;
  else if (castrado === "ns" || castrado === "" || castrado == null) payload.castrado = null;
  if (temperamento !== undefined) payload.temperamento = temperamento || null;
  if (clinica_cabecera_id !== undefined) {
    payload.clinica_cabecera_id = clinica_cabecera_id || null;
  }

  let { data, error } = await supabase
    .from("mascotas")
    .update(payload)
    .eq("id", chapitaId)
    .select("id, fecha_nacimiento, peso, castrado, temperamento, clinica_cabecera_id")
    .single();

  if (error && /temperamento|schema cache|does not exist/i.test(error.message || "")) {
    delete payload.temperamento;
    ({ data, error } = await supabase
      .from("mascotas")
      .update(payload)
      .eq("id", chapitaId)
      .select("id, fecha_nacimiento, peso, castrado, clinica_cabecera_id")
      .single());
  }

  if (error && /clinica_cabecera|schema cache|does not exist/i.test(error.message || "")) {
    delete payload.clinica_cabecera_id;
    ({ data, error } = await supabase
      .from("mascotas")
      .update(payload)
      .eq("id", chapitaId)
      .select("id, fecha_nacimiento, peso, castrado, temperamento")
      .single());
  }

  if (error) throw missing(error) || new Error(error.message);
  return data;
}

export async function crearTratamiento(clinicaId, payload) {
  return run(
    supabase
      .from("clinica_tratamientos")
      .insert({
        clinica_id: clinicaId,
        paciente_id: payload.paciente_id,
        titulo: payload.titulo.trim(),
        detalle: payload.detalle?.trim() || null,
        fecha_inicio: payload.fecha_inicio || new Date().toISOString().slice(0, 10),
        fecha_fin: payload.de_por_vida ? null : payload.fecha_fin || null,
        de_por_vida: Boolean(payload.de_por_vida),
        activo: true,
      })
      .select("id, titulo, detalle, fecha_inicio, fecha_fin, de_por_vida, activo")
      .single(),
  );
}

function basePerfil(mascota, extras = {}) {
  const fechaNacimiento = extras.fecha_nacimiento ?? mascota.fecha_nacimiento ?? null;
  const peso = extras.peso ?? mascota.peso ?? null;
  return {
    chapitaId: mascota.id,
    tutor_id: mascota.tutor_id,
    nombre: mascota.nombre_mascota,
    especie: mascota.especie || null,
    raza: mascota.raza || null,
    sexo: mascota.sexo || null,
    castrado: mascota.castrado,
    temperamento: mascota.temperamento || null,
    nro_chip: mascota.nro_chip || null,
    foto_url: mascota.foto_url || null,
    clinica_cabecera_id: mascota.clinica_cabecera_id || null,
    clinica_cabecera: extras.clinica_cabecera ?? mascota.clinicas ?? null,
    fecha_nacimiento: fechaNacimiento,
    peso,
    edad: calcEdad(fechaNacimiento),
    vacunas: extras.vacunas ?? [],
    consultas: extras.consultas ?? [],
    proximaCita: extras.proximaCita ?? null,
    tratamientos: extras.tratamientos ?? [],
    tieneVinculoClinico: Boolean(extras.tieneVinculoClinico),
    pacienteIds: extras.pacienteIds ?? [],
  };
}

export async function cargarPerfilClinicoMascota(chapitaId) {
  let { data: mascota, error } = await supabase
    .from("mascotas")
    .select(
      "id, tutor_id, nombre_mascota, especie, raza, sexo, castrado, temperamento, nro_chip, foto_url, fecha_nacimiento, peso, clinica_cabecera_id, clinicas:clinica_cabecera_id(id, nombre, ciudad)",
    )
    .eq("id", chapitaId)
    .maybeSingle();

  if (error && /temperamento|schema cache|does not exist/i.test(error.message || "")) {
    ({ data: mascota, error } = await supabase
      .from("mascotas")
      .select(
        "id, tutor_id, nombre_mascota, especie, raza, sexo, castrado, nro_chip, foto_url, fecha_nacimiento, peso, clinica_cabecera_id, clinicas:clinica_cabecera_id(id, nombre, ciudad)",
      )
      .eq("id", chapitaId)
      .maybeSingle());
    if (!error && mascota) mascota = { ...mascota, temperamento: null };
  }

  if (error && /clinica_cabecera|schema cache|does not exist/i.test(error.message || "")) {
    ({ data: mascota, error } = await supabase
      .from("mascotas")
      .select(
        "id, tutor_id, nombre_mascota, especie, raza, sexo, castrado, temperamento, nro_chip, foto_url, fecha_nacimiento, peso",
      )
      .eq("id", chapitaId)
      .maybeSingle());
    if (!error && mascota) {
      mascota = { ...mascota, clinica_cabecera_id: null, clinicas: null };
    }
  }

  if (error) throw missing(error) || new Error(error.message);
  if (!mascota) {
    return null;
  }

  const pacientes =
    (await run(
      supabase
        .from("clinica_pacientes")
        .select("id, clinica_id, cliente_id, fecha_nacimiento, peso, nombre")
        .or(`mascota_chapita_id.eq.${chapitaId},chapita_codigo.eq.${chapitaId}`)
        .eq("activo", true),
    )) ?? [];

  const pacienteIds = pacientes.map((p) => p.id);
  const fechaNacimiento =
    mascota.fecha_nacimiento || pacientes.find((p) => p.fecha_nacimiento)?.fecha_nacimiento || null;
  const peso =
    mascota.peso ?? pacientes.find((p) => p.peso != null)?.peso ?? null;

  const tutorVacunasPromise = (async () => {
    if (!mascota.tutor_id) return [];
    let query = supabase
      .from("tutor_vacunas")
      .select("id, nombre, fecha, proxima_fecha, lote, notas, mascota_id, paciente_id")
      .eq("tutor_id", mascota.tutor_id)
      .order("fecha", { ascending: false });
    if (pacienteIds.length) {
      query = query.or(
        `mascota_id.eq.${chapitaId},paciente_id.in.(${pacienteIds.join(",")})`,
      );
    } else {
      query = query.eq("mascota_id", chapitaId);
    }
    const { data, error } = await query;
    if (error) {
      if (/tutor_vacunas|schema cache|does not exist/i.test(error.message)) return [];
      throw missing(error) || new Error(error.message);
    }
    return (data ?? []).map((v) => ({ ...v, origen: "tutor" }));
  })();

  const tutorTratamientosPromise = (async () => {
    if (!mascota.tutor_id) return [];
    let query = supabase
      .from("tutor_tratamientos")
      .select(
        "id, titulo, detalle, fecha_inicio, fecha_fin, de_por_vida, activo, mascota_id, paciente_id",
      )
      .eq("tutor_id", mascota.tutor_id)
      .eq("activo", true)
      .order("fecha_inicio", { ascending: false });
    if (pacienteIds.length) {
      query = query.or(
        `mascota_id.eq.${chapitaId},paciente_id.in.(${pacienteIds.join(",")})`,
      );
    } else {
      query = query.eq("mascota_id", chapitaId);
    }
    const { data, error } = await query;
    if (error) {
      if (/tutor_tratamientos|schema cache|does not exist/i.test(error.message)) return [];
      throw missing(error) || new Error(error.message);
    }
    return (data ?? []).map((t) => ({ ...t, origen: "tutor" }));
  })();

  function filtrarTratamientosActivos(rows) {
    const hoy = new Date().toISOString().slice(0, 10);
    return (rows ?? []).filter((t) => {
      if (t.activo === false) return false;
      if (t.de_por_vida) return true;
      if (!t.fecha_fin) return true;
      return t.fecha_fin >= hoy;
    });
  }

  if (!pacienteIds.length) {
    const [tutorVacunas, tutorTratamientos] = await Promise.all([
      tutorVacunasPromise,
      tutorTratamientosPromise,
    ]);
    return basePerfil(mascota, {
      fecha_nacimiento: fechaNacimiento,
      peso,
      vacunas: tutorVacunas,
      tratamientos: filtrarTratamientosActivos(tutorTratamientos),
      tieneVinculoClinico: false,
    });
  }

  const nowISO = new Date().toISOString();
  const [vacunas, consultas, citas, tratamientos, tutorVacunas, tutorTratamientos] =
    await Promise.all([
      run(
        supabase
          .from("clinica_vacunas")
          .select("id, nombre, fecha, proxima_fecha, notas")
          .in("paciente_id", pacienteIds)
          .order("fecha", { ascending: false }),
      ),
      run(
        supabase
          .from("clinica_consultas")
          .select("id, fecha, motivo, diagnostico, tratamiento, medicacion, cerrada")
          .in("paciente_id", pacienteIds)
          .order("fecha", { ascending: false })
          .limit(20),
      ),
      run(
        supabase
          .from("clinica_citas")
          .select(
            "id, inicio, fin, estado, motivo, clinicas(nombre, ciudad), clinica_veterinarios(nombre)",
          )
          .in("paciente_id", pacienteIds)
          .in("estado", ["pendiente", "confirmada", "en_espera", "en_atencion", "lista_espera"])
          .gte("inicio", nowISO)
          .order("inicio", { ascending: true })
          .limit(1),
      ),
      run(
        supabase
          .from("clinica_tratamientos")
          .select(
            "id, titulo, detalle, fecha_inicio, fecha_fin, de_por_vida, activo, clinica_id, clinicas(nombre)",
          )
          .in("paciente_id", pacienteIds)
          .eq("activo", true)
          .order("fecha_inicio", { ascending: false }),
      ),
      tutorVacunasPromise,
      tutorTratamientosPromise,
    ]);

  const tratamientosMerged = filtrarTratamientosActivos([
    ...(tratamientos ?? []).map((t) => ({
      ...t,
      origen: "clinica",
      clinica_nombre: t.clinicas?.nombre || null,
    })),
    ...(tutorTratamientos ?? []),
  ]).sort((a, b) => new Date(b.fecha_inicio) - new Date(a.fecha_inicio));

  const vacunasMerged = [
    ...(vacunas ?? []).map((v) => ({ ...v, origen: "clinica" })),
    ...(tutorVacunas ?? []),
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return basePerfil(mascota, {
    fecha_nacimiento: fechaNacimiento,
    peso,
    vacunas: vacunasMerged,
    consultas: consultas ?? [],
    proximaCita: citas?.[0] || null,
    tratamientos: tratamientosMerged,
    tieneVinculoClinico: true,
    pacienteIds,
  });
}
