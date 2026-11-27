import { createClient } from "@supabase/supabase-js";

import { dispatchPushNotification } from "@/lib/chapitas/dispatchPush";
import { buildEscaneoMensaje, resolveEscaneoLocation } from "@/lib/chapitas/geoIp";

const DEDUPE_MINUTES = 30;

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Faltan variables de Supabase para registrar el escaneo.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function hasGpsCoords(coords) {
  if (!coords || typeof coords !== "object") return false;
  const lat = Number(coords.lat ?? coords.latitude ?? coords.latitud);
  const lon = Number(coords.lon ?? coords.lng ?? coords.longitude ?? coords.longitud);
  return Number.isFinite(lat) && Number.isFinite(lon);
}

/**
 * Registra un escaneo de ficha pública, resuelve geo (GPS o IP) y notifica al tutor.
 * Nunca lanza por fallo de geo: el escaneo se guarda igual.
 *
 * Con coords GPS se permite una 2ª alerta aunque ya haya un escaneo reciente por IP
 * (actualización de precisión).
 *
 * @param {object} [opts]
 * @param {string} [opts.mascotaId]
 * @param {string|null} [opts.ip]
 * @param {string|null} [opts.userAgent]
 * @param {{ lat?: number, lon?: number, accuracy?: number }|null} [opts.coords]
 */
export async function registrarEscaneoChapita({
  mascotaId,
  ip,
  userAgent,
  coords = null,
} = {}) {
  if (!mascotaId || typeof mascotaId !== "string") {
    return { ok: false, error: "mascota_id_requerido" };
  }

  const supabase = getServerSupabase();
  const gpsUpdate = hasGpsCoords(coords);

  const { data: mascota, error: mascotaError } = await supabase
    .from("mascotas")
    .select("id, nombre_mascota, tutor_id")
    .eq("id", mascotaId)
    .maybeSingle();

  if (mascotaError) {
    if (/schema cache|does not exist/i.test(mascotaError.message || "")) {
      return { ok: false, error: "schema_mascotas" };
    }
    return { ok: false, error: mascotaError.message };
  }
  if (!mascota) {
    return { ok: false, error: "mascota_no_encontrada" };
  }

  const since = new Date(Date.now() - DEDUPE_MINUTES * 60 * 1000).toISOString();

  // Dedupe solo para escaneos sin GPS (misma IP). Un GPS posterior debe notificar de nuevo.
  if (ip && !gpsUpdate) {
    const { data: recent } = await supabase
      .from("chapita_escaneos")
      .select("id, ubicacion_label, maps_url, ciudad, region, pais, creado_en, fuente_geo")
      .eq("mascota_id", mascota.id)
      .eq("ip", ip)
      .gte("creado_en", since)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent) {
      return {
        ok: true,
        deduped: true,
        escaneoId: recent.id,
        ubicacion_label: recent.ubicacion_label,
        maps_url: recent.maps_url,
      };
    }
  }

  // Evitar spam: si ya hubo un GPS reciente con precisión similar o mejor, no repetir.
  if (gpsUpdate && ip) {
    const { data: recentGps } = await supabase
      .from("chapita_escaneos")
      .select("id, ubicacion_label, maps_url, fuente_geo, latitud, longitud, creado_en")
      .eq("mascota_id", mascota.id)
      .eq("fuente_geo", "gps")
      .gte("creado_en", since)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentGps?.latitud != null && recentGps?.longitud != null) {
      const lat = Number(coords.lat ?? coords.latitude);
      const lon = Number(coords.lon ?? coords.longitude);
      const dLat = Math.abs(Number(recentGps.latitud) - lat);
      const dLon = Math.abs(Number(recentGps.longitud) - lon);
      // ~50 m a lat media (~0.00045°)
      if (dLat < 0.0005 && dLon < 0.0005) {
        return {
          ok: true,
          deduped: true,
          escaneoId: recentGps.id,
          ubicacion_label: recentGps.ubicacion_label,
          maps_url: recentGps.maps_url,
        };
      }
    }
  }

  const geo = await resolveEscaneoLocation({ ip, coords });
  const fueActualizacionGps = gpsUpdate && geo.fuente_geo === "gps";

  // ¿Había un escaneo reciente sin GPS? → esta es la 2ª alerta de precisión.
  let actualizacionGps = false;
  if (fueActualizacionGps) {
    const { data: prev } = await supabase
      .from("chapita_escaneos")
      .select("id, fuente_geo")
      .eq("mascota_id", mascota.id)
      .gte("creado_en", since)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    actualizacionGps = Boolean(prev && prev.fuente_geo !== "gps");
  }

  const row = {
    mascota_id: mascota.id,
    tutor_id: mascota.tutor_id || null,
    ip: ip || null,
    ciudad: geo.ciudad,
    region: geo.region,
    pais: geo.pais,
    latitud: geo.latitud,
    longitud: geo.longitud,
    ubicacion_label: geo.ubicacion_label,
    maps_url: geo.maps_url,
    user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
    fuente_geo: geo.fuente_geo,
  };

  const { data: escaneo, error: insertError } = await supabase
    .from("chapita_escaneos")
    .insert(row)
    .select("id, ubicacion_label, maps_url")
    .single();

  if (insertError) {
    if (/chapita_escaneos|schema cache|does not exist/i.test(insertError.message || "")) {
      return {
        ok: false,
        error: "Falta esquema de escaneos. Ejecutá supabase/chapitas/40_chapita_escaneos.sql.",
        geo_error: geo.error,
      };
    }
    return { ok: false, error: insertError.message, geo_error: geo.error };
  }

  if (mascota.tutor_id) {
    const titulo = actualizacionGps
      ? `${mascota.nombre_mascota || "Tu mascota"}: ubicación GPS actualizada`
      : geo.ubicacion_label
        ? `${mascota.nombre_mascota || "Tu mascota"} fue escaneada cerca de ${geo.ubicacion_label}`
        : `${mascota.nombre_mascota || "Tu mascota"} fue escaneada`;
    const mensaje = buildEscaneoMensaje({
      nombreMascota: mascota.nombre_mascota,
      ubicacionLabel: geo.ubicacion_label,
      fuenteGeo: geo.fuente_geo,
      accuracy: geo.accuracy ?? coords?.accuracy ?? null,
      actualizacionGps,
    });

    const { error: notifError } = await supabase.from("tutor_notificaciones").insert({
      tutor_id: mascota.tutor_id,
      tipo: "qr_escaneo",
      titulo,
      mensaje,
      leida: false,
    });

    if (
      notifError &&
      !/tutor_notificaciones|schema cache|does not exist/i.test(notifError.message || "")
    ) {
      console.error("[escaneo] notif tutor:", notifError.message);
    } else if (!notifError) {
      dispatchPushNotification({
        audience: "tutor",
        audienceId: mascota.tutor_id,
        title: titulo,
        body: mensaje,
        url: "/tutor",
        // Tag distinto para que el push de GPS no reemplace al aviso inicial.
        tag: actualizacionGps
          ? `qr-escaneo-gps-${mascota.id}`
          : `qr-escaneo-${mascota.id}`,
      });
    }
  }

  return {
    ok: true,
    deduped: false,
    actualizacionGps,
    escaneoId: escaneo.id,
    ubicacion_label: escaneo.ubicacion_label,
    maps_url: escaneo.maps_url,
    geo_error: geo.error || null,
  };
}
