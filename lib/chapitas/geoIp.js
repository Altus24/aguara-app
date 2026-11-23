/**
 * Ubicación aproximada por IP (sin geolocalización del navegador).
 * Usa ipapi.co por defecto; opcionalmente ipinfo.io con IPINFO_TOKEN.
 */

const PRIVATE_IP_RE =
  /^(::1|::ffff:127\.|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|fc|fd|fe80)/i;

export function isPrivateOrLocalIp(ip) {
  if (!ip || typeof ip !== "string") return true;
  const cleaned = ip.trim().toLowerCase();
  if (cleaned === "localhost" || cleaned === "unknown") return true;
  return PRIVATE_IP_RE.test(cleaned);
}

/**
 * Extrae la IP del cliente desde headers de proxy / Next.
 * @param {Headers | { get: (name: string) => string | null }} headers
 */
export function getClientIpFromHeaders(headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  return null;
}

function emptyLocation(reason) {
  return {
    ciudad: null,
    region: null,
    pais: null,
    latitud: null,
    longitud: null,
    ubicacion_label: null,
    maps_url: null,
    fuente_geo: null,
    error: reason || null,
  };
}

function buildLabel({ ciudad, region, pais }) {
  const parts = [ciudad, region, pais].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function buildMapsUrl(lat, lon) {
  if (lat == null || lon == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) {
    return null;
  }
  return `https://maps.google.com/?q=${lat},${lon}`;
}

async function lookupIpapi(ip, { signal } = {}) {
  const key = process.env.IPAPI_KEY?.trim();
  const url = key
    ? `https://ipapi.co/${encodeURIComponent(ip)}/json/?key=${encodeURIComponent(key)}`
    : `https://ipapi.co/${encodeURIComponent(ip)}/json/`;

  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`ipapi.co HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data?.error) {
    throw new Error(data.reason || data.error || "ipapi.co error");
  }
  const ciudad = data.city || null;
  const region = data.region || data.region_code || null;
  const pais = data.country_name || data.country || null;
  const latitud = data.latitude != null ? Number(data.latitude) : null;
  const longitud = data.longitude != null ? Number(data.longitude) : null;
  return {
    ciudad,
    region,
    pais,
    latitud: Number.isFinite(latitud) ? latitud : null,
    longitud: Number.isFinite(longitud) ? longitud : null,
    ubicacion_label: buildLabel({ ciudad, region, pais }),
    maps_url: buildMapsUrl(latitud, longitud),
    fuente_geo: "ipapi.co",
    error: null,
  };
}

async function lookupIpinfo(ip, { signal } = {}) {
  const token = process.env.IPINFO_TOKEN?.trim();
  const url = token
    ? `https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${encodeURIComponent(token)}`
    : `https://ipinfo.io/${encodeURIComponent(ip)}/json`;

  const res = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`ipinfo.io HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data?.error) {
    throw new Error(data.error?.message || "ipinfo.io error");
  }
  const [latRaw, lonRaw] = String(data.loc || "")
    .split(",")
    .map((v) => Number(v.trim()));
  const ciudad = data.city || null;
  const region = data.region || null;
  const pais = data.country || null;
  const latitud = Number.isFinite(latRaw) ? latRaw : null;
  const longitud = Number.isFinite(lonRaw) ? lonRaw : null;
  return {
    ciudad,
    region,
    pais,
    latitud,
    longitud,
    ubicacion_label: buildLabel({ ciudad, region, pais }),
    maps_url: buildMapsUrl(latitud, longitud),
    fuente_geo: "ipinfo.io",
    error: null,
  };
}

/**
 * Consulta ubicación aproximada. Si el servicio falla, devuelve campos null + error
 * (no lanza) para que el escaneo igual se pueda registrar.
 */
export async function lookupApproxLocationByIp(ip, { timeoutMs = 4000 } = {}) {
  if (isPrivateOrLocalIp(ip)) {
    return emptyLocation("ip_privada_o_local");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const provider = (process.env.GEOIP_PROVIDER || "ipapi").toLowerCase();
    try {
      if (provider === "ipinfo") {
        return await lookupIpinfo(ip, { signal: controller.signal });
      }
      return await lookupIpapi(ip, { signal: controller.signal });
    } catch (primaryError) {
      try {
        if (provider === "ipinfo") {
          return await lookupIpapi(ip, { signal: controller.signal });
        }
        return await lookupIpinfo(ip, { signal: controller.signal });
      } catch {
        return emptyLocation(primaryError?.message || "geoip_fallo");
      }
    }
  } catch (error) {
    return emptyLocation(error?.message || "geoip_fallo");
  } finally {
    clearTimeout(timer);
  }
}

export function buildEscaneoMensaje({ nombreMascota, ubicacionLabel }) {
  const nombre = nombreMascota || "Tu mascota";
  if (ubicacionLabel) {
    return `${nombre} fue escaneada cerca de ${ubicacionLabel}. Es una ubicación aproximada por IP (no GPS).`;
  }
  return `${nombre} fue escaneada. No pudimos estimar la zona (ubicación aproximada no disponible).`;
}
