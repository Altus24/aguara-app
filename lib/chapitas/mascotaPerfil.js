import { supabase } from "@/lib/chapitas/supabaseClient";
import { calcEdad } from "@/lib/chapitas/tutorPortal";

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

export async function actualizarDatosBasicosMascota(chapitaId, { fecha_nacimiento, peso }) {
  return run(
    supabase
      .from("mascotas")
      .update({
        fecha_nacimiento: fecha_nacimiento || null,
        peso: peso === "" || peso == null ? null : Number(peso),
      })
      .eq("id", chapitaId)
      .select("id, fecha_nacimiento, peso")
      .single(),
  );
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
    nro_chip: mascota.nro_chip || null,
    foto_url: mascota.foto_url || null,
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
  const mascota = await run(
    supabase
      .from("mascotas")
      .select(
        "id, tutor_id, nombre_mascota, especie, raza, sexo, castrado, nro_chip, foto_url, fecha_nacimiento, peso",
      )
      .eq("id", chapitaId)
      .maybeSingle(),
  );

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

  if (!pacienteIds.length) {
    return basePerfil(mascota, {
      fecha_nacimiento: fechaNacimiento,
      peso,
      tieneVinculoClinico: false,
    });
  }

  const nowISO = new Date().toISOString();
  const [vacunas, consultas, citas, tratamientos] = await Promise.all([
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
        .select("id, titulo, detalle, fecha_inicio, fecha_fin, de_por_vida, activo")
        .in("paciente_id", pacienteIds)
        .eq("activo", true)
        .order("fecha_inicio", { ascending: false }),
    ),
  ]);

  const hoy = new Date().toISOString().slice(0, 10);
  const tratamientosActivos = (tratamientos ?? []).filter((t) => {
    if (!t.activo) return false;
    if (t.de_por_vida) return true;
    if (!t.fecha_fin) return true;
    return t.fecha_fin >= hoy;
  });

  return basePerfil(mascota, {
    fecha_nacimiento: fechaNacimiento,
    peso,
    vacunas: vacunas ?? [],
    consultas: consultas ?? [],
    proximaCita: citas?.[0] || null,
    tratamientos: tratamientosActivos,
    tieneVinculoClinico: true,
    pacienteIds,
  });
}
