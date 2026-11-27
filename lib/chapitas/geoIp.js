/**
 * Ubicación del escaneo:
 * 1) GPS del dispositivo (si el navegador la envía) + reverse geocode
 * 2) Fallback por IP (aproximado; puede fallar en LatAm / VPN / CGNAT)
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
 * Extrae la IP del cliente desde headers de proxy / Next / Vercel / Cloudflare.
 * @param {Headers | { get: (name: string) => string | null }} headers
 */
export function getClientIpFromHeaders(headers) {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("true-client-ip"),
    headers.get("x-real-ip"),
    headers.get("x-vercel-forwarded-for"),
    headers.get("x-forwarded-for"),
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const first = String(raw).split(",")[0]?.trim();
    if (first && !isPrivateOrLocalIp(first)) return first;
    if (first) return first;
  }
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

function normalizeCoords(coords) {
  if (!coords || typeof coords !== "object") return null;
  const latitud = Number(coords.lat ?? coords.latitude ?? coords.latitud);
  const longitud = Number(coords.lon ?? coords.lng ?? coords.longitude ?? coords.longitud);
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;
  if (latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180) return null;
  const accuracy =
    coords.accuracy != null && Number.isFinite(Number(coords.accuracy))
      ? Number(coords.accuracy)
      : null;
  return { latitud, longitud, accuracy };
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

/** ip-api.com (HTTP) suele mapear mejor LatAm en el plan free. */
async function lookupIpApiCom(ip, { signal } = {}) {
  const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,regionName,city,lat,lon`;
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`ip-api.com HTTP ${res.status}`);
  const data = await res.json();
  if (data?.status !== "success") {
    throw new Error(data?.message || "ip-api.com error");
  }
  const ciudad = data.city || null;
  const region = data.regionName || null;
  const pais = data.country || null;
  const latitud = data.lat != null ? Number(data.lat) : null;
  const longitud = data.lon != null ? Number(data.lon) : null;
  return {
    ciudad,
    region,
    pais,
    latitud: Number.isFinite(latitud) ? latitud : null,
    longitud: Number.isFinite(longitud) ? longitud : null,
    ubicacion_label: buildLabel({ ciudad, region, pais }),
    maps_url: buildMapsUrl(latitud, longitud),
    fuente_geo: "ip-api.com",
    error: null,
  };
}

/**
 * Reverse geocode (Nominatim). Uso razonable: 1 req/escaneo con User-Agent propio.
 */
export async function reverseGeocode(latitud, longitud, { signal, timeoutMs = 4000 } = {}) {
  const controller = signal ? null : new AbortController();
  const abortSignal = signal || controller.signal;
  const timer =
    controller && timeoutMs
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitud)}` +
      `&lon=${encodeURIComponent(longitud)}&accept-language=es`;
    const res = await fetch(url, {
      signal: abortSignal,
      headers: {
        Accept: "application/json",
        "User-Agent": "AguaraApp/1.0 (escaneos-qr; soporte@aguara.app)",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`nominatim HTTP ${res.status}`);
    const data = await res.json();
    const a = data?.address || {};
    const ciudad =
      a.city || a.town || a.village || a.municipality || a.city_district || a.suburb || null;
    const region = a.state || a.region || a.province || null;
    const pais = a.country || null;
    return {
      ciudad,
      region,
      pais,
      latitud,
      longitud,
      ubicacion_label: buildLabel({ ciudad, region, pais }) || data?.display_name || null,
      maps_url: buildMapsUrl(latitud, longitud),
      fuente_geo: "gps",
      error: null,
    };
  } catch (error) {
    return {
      ciudad: null,
      region: null,
      pais: null,
      latitud,
      longitud,
      ubicacion_label: null,
      maps_url: buildMapsUrl(latitud, longitud),
      fuente_geo: "gps",
      error: error?.message || "reverse_geocode_fallo",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Consulta ubicación aproximada por IP. Si el servicio falla, campos null + error.
 */
export async function lookupApproxLocationByIp(ip, { timeoutMs = 4000 } = {}) {
  if (isPrivateOrLocalIp(ip)) {
    return emptyLocation("ip_privada_o_local");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const provider = (process.env.GEOIP_PROVIDER || "ipapi").toLowerCase();
  const chain =
    provider === "ipinfo"
      ? [lookupIpinfo, lookupIpapi, lookupIpApiCom]
      : provider === "ip-api"
        ? [lookupIpApiCom, lookupIpapi, lookupIpinfo]
        : [lookupIpapi, lookupIpApiCom, lookupIpinfo];

  try {
    let lastError = null;
    for (const fn of chain) {
      try {
        return await fn(ip, { signal: controller.signal });
      } catch (err) {
        lastError = err;
      }
    }
    return emptyLocation(lastError?.message || "geoip_fallo");
  } catch (error) {
    return emptyLocation(error?.message || "geoip_fallo");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resuelve ubicación del escaneo: GPS primero, IP como respaldo.
 * @param {{ ip?: string|null, coords?: { lat?: number, lon?: number, accuracy?: number }|null }} opts
 */
export async function resolveEscaneoLocation({ ip = null, coords = null } = {}) {
  const normalized = normalizeCoords(coords);
  if (normalized) {
    const geo = await reverseGeocode(normalized.latitud, normalized.longitud);
    // Si reverse falla, igual guardamos coords GPS (más útiles que IP errónea).
    if (!geo.ubicacion_label) {
      geo.ubicacion_label = `GPS (${normalized.latitud.toFixed(4)}, ${normalized.longitud.toFixed(4)})`;
    }
    return geo;
  }
  return lookupApproxLocationByIp(ip);
}

export function buildEscaneoMensaje({ nombreMascota, ubicacionLabel, fuenteGeo }) {
  const nombre = nombreMascota || "Tu mascota";
  if (ubicacionLabel) {
    if (fuenteGeo === "gps") {
      return `${nombre} fue escaneada cerca de ${ubicacionLabel} (ubicación del dispositivo).`;
    }
    return `${nombre} fue escaneada cerca de ${ubicacionLabel}. Es una ubicación aproximada por IP (no GPS).`;
  }
  return `${nombre} fue escaneada. No pudimos estimar la zona (ubicación aproximada no disponible).`;
}
