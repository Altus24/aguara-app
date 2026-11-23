import { createClient } from "@supabase/supabase-js";

import { dispatchPushNotification } from "@/lib/chapitas/dispatchPush";
import {
  RECORDATORIO_DIAS_ANTICIPO,
  diasHastaFecha,
  etiquetaDiasVencimiento,
  fechaHoyISO,
  fechaMasDiasISO,
} from "@/lib/chapitas/recordatoriosVentana";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase no configurado para avisos de vencimiento.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function refKey(tipo, id) {
  return `${tipo}:${id}`;
}

/**
 * Recolecta vencimientos en la ventana (hoy … +7 días).
 * @param {{ tutorId?: string|null }} [opts]
 */
export async function listarVencimientosProximos({ tutorId = null } = {}) {
  const supabase = getSupabaseAdmin();
  const hoy = fechaHoyISO();
  const hasta = fechaMasDiasISO(RECORDATORIO_DIAS_ANTICIPO);
  /** @type {Array<{ tutorId: string, ref: string, titulo: string, mensaje: string, dias: number, fecha: string }>} */
  const items = [];

  const pushItem = (tutor, ref, titulo, mensajeBase, fecha) => {
    if (!tutor) return;
    if (tutorId && String(tutor) !== String(tutorId)) return;
    const dias = diasHastaFecha(fecha);
    if (dias == null || dias < 0 || dias > RECORDATORIO_DIAS_ANTICIPO) return;
    items.push({
      tutorId: String(tutor),
      ref,
      titulo,
      mensaje: `${mensajeBase} · ${etiquetaDiasVencimiento(dias)}`,
      dias,
      fecha: String(fecha).slice(0, 10),
    });
  };

  const { data: tutorVacunas } = await supabase
    .from("tutor_vacunas")
    .select("id, tutor_id, nombre, proxima_fecha, mascotas:mascota_id(nombre_mascota)")
    .not("proxima_fecha", "is", null)
    .gte("proxima_fecha", hoy)
    .lte("proxima_fecha", hasta);
  for (const v of tutorVacunas || []) {
    const mascota = v.mascotas?.nombre_mascota || "tu mascota";
    pushItem(
      v.tutor_id,
      refKey("tutor_vacuna", v.id),
      "Vacuna por vencer",
      `${v.nombre} de ${mascota}`,
      v.proxima_fecha,
    );
  }

  const { data: tutorRecs } = await supabase
    .from("tutor_recordatorios")
    .select("id, tutor_id, tipo, titulo, fecha_proxima, mascotas:mascota_id(nombre_mascota)")
    .eq("activo", true)
    .not("fecha_proxima", "is", null)
    .gte("fecha_proxima", hoy)
    .lte("fecha_proxima", hasta);
  for (const r of tutorRecs || []) {
    const mascota = r.mascotas?.nombre_mascota || "tu mascota";
    const tipo =
      r.tipo === "medicacion"
        ? "Medicación"
        : r.tipo === "vacuna"
          ? "Vacuna"
          : r.tipo === "control"
            ? "Control"
            : "Recordatorio";
    pushItem(
      r.tutor_id,
      refKey("tutor_recordatorio", r.id),
      `${tipo} por vencer`,
      `${r.titulo} · ${mascota}`,
      r.fecha_proxima,
    );
  }

  const { data: clinicaVacunas } = await supabase
    .from("clinica_vacunas")
    .select(
      "id, nombre, proxima_fecha, clinica_pacientes(nombre, clinica_clientes(tutor_id))",
    )
    .not("proxima_fecha", "is", null)
    .gte("proxima_fecha", hoy)
    .lte("proxima_fecha", hasta);
  for (const v of clinicaVacunas || []) {
    const tutor = v.clinica_pacientes?.clinica_clientes?.tutor_id;
    const mascota = v.clinica_pacientes?.nombre || "tu mascota";
    pushItem(
      tutor,
      refKey("clinica_vacuna", v.id),
      "Vacuna por vencer",
      `${v.nombre} de ${mascota}`,
      v.proxima_fecha,
    );
  }

  const { data: clinicaDesp } = await supabase
    .from("clinica_desparasitaciones")
    .select(
      "id, producto, proxima_fecha, clinica_pacientes(nombre, clinica_clientes(tutor_id))",
    )
    .not("proxima_fecha", "is", null)
    .gte("proxima_fecha", hoy)
    .lte("proxima_fecha", hasta);
  for (const d of clinicaDesp || []) {
    const tutor = d.clinica_pacientes?.clinica_clientes?.tutor_id;
    const mascota = d.clinica_pacientes?.nombre || "tu mascota";
    pushItem(
      tutor,
      refKey("clinica_desparasitacion", d.id),
      "Desparasitación por vencer",
      `${d.producto} de ${mascota}`,
      d.proxima_fecha,
    );
  }

  const { data: clinicaRecs } = await supabase
    .from("clinica_recordatorios")
    .select(
      "id, tipo, titulo, fecha_proxima, cliente_id, clinica_pacientes(nombre, clinica_clientes(tutor_id)), clinica_clientes(tutor_id)",
    )
    .eq("activo", true)
    .not("fecha_proxima", "is", null)
    .gte("fecha_proxima", hoy)
    .lte("fecha_proxima", hasta);
  for (const r of clinicaRecs || []) {
    const tutor =
      r.clinica_pacientes?.clinica_clientes?.tutor_id || r.clinica_clientes?.tutor_id;
    const mascota = r.clinica_pacientes?.nombre || "tu mascota";
    const tipo =
      r.tipo === "medicacion"
        ? "Medicación"
        : r.tipo === "vacuna"
          ? "Vacuna"
          : r.tipo === "control"
            ? "Control"
            : "Recordatorio";
    pushItem(
      tutor,
      refKey("clinica_recordatorio", r.id),
      `${tipo} por vencer`,
      `${r.titulo} · ${mascota}`,
      r.fecha_proxima,
    );
  }

  return items;
}

/**
 * Inserta notificación in-app + push (1 por ítem y día).
 * @param {{ tutorId?: string|null }} [opts]
 */
export async function avisarRecordatoriosVencimiento({ tutorId = null } = {}) {
  const supabase = getSupabaseAdmin();
  const hoy = fechaHoyISO();
  const items = await listarVencimientosProximos({ tutorId });
  let enviados = 0;
  let omitidos = 0;

  for (const item of items) {
    const dedupeTag = `venc-${item.ref}-${hoy}`;
    const desde = `${hoy}T00:00:00.000Z`;
    const { data: previas } = await supabase
      .from("tutor_notificaciones")
      .select("id, mensaje")
      .eq("tutor_id", item.tutorId)
      .eq("tipo", "recordatorio_vencimiento")
      .gte("creado_en", desde)
      .limit(40);

    const ya = (previas || []).some(
      (n) => String(n.mensaje || "").includes(`[${item.ref}]`) || String(n.mensaje || "").includes(dedupeTag),
    );
    if (ya) {
      omitidos += 1;
      continue;
    }

    const mensaje = `${item.mensaje} [${item.ref}]`;
    const { error } = await supabase.from("tutor_notificaciones").insert({
      tutor_id: item.tutorId,
      tipo: "recordatorio_vencimiento",
      titulo: item.titulo,
      mensaje,
      leida: false,
    });

    if (error) {
      if (!/tutor_notificaciones|schema cache|does not exist/i.test(error.message || "")) {
        console.error("[avisarRecordatorios]", error.message);
      }
      continue;
    }

    dispatchPushNotification({
      audience: "tutor",
      audienceId: item.tutorId,
      title: item.titulo,
      body: item.mensaje,
      url: "/tutor?tab=recordatorios",
      tag: dedupeTag,
    });
    enviados += 1;
  }

  return { ok: true, total: items.length, enviados, omitidos, hoy };
}
