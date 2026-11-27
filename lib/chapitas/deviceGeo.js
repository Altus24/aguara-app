/**
 * Geolocalización del dispositivo para escaneos / compartir ubicación.
 * Spec: getCurrentPosition + enableHighAccuracy + timeout 10–15s + maximumAge: 0.
 */

/**
 * @param {GeolocationPosition} pos
 * @returns {{ lat: number, lon: number, accuracy: number|null, mapsUrl: string }}
 */
function mapPosition(pos) {
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;
  const accuracy =
    pos.coords.accuracy != null && Number.isFinite(pos.coords.accuracy)
      ? pos.coords.accuracy
      : null;
  return {
    lat,
    lon,
    accuracy,
    mapsUrl: `https://maps.google.com/?q=${lat},${lon}`,
  };
}

/**
 * Lectura GPS según la verificación acordada.
 * No reutiliza caché (maximumAge: 0). Rechazo/timeout → reject (el caller no rompe la UI).
 *
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=15000]
 * @returns {Promise<{ lat: number, lon: number, accuracy: number|null, mapsUrl: string }>}
 */
export function getCurrentPositionHighAccuracy({ timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("geolocation_no_disponible"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(mapPosition(pos)),
      (err) => reject(err || new Error("geolocation_fallo")),
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      },
    );
  });
}

/**
 * Alias usado al compartir ubicación (misma API / opciones).
 */
export function getPreciseDevicePosition(opts = {}) {
  return getCurrentPositionHighAccuracy({
    timeoutMs: opts.timeoutMs ?? 15000,
  });
}

export function formatAccuracyLabel(accuracyMeters) {
  if (accuracyMeters == null || !Number.isFinite(accuracyMeters)) return null;
  if (accuracyMeters < 1000) return `±${Math.round(accuracyMeters)} m`;
  return `±${(accuracyMeters / 1000).toFixed(1)} km`;
}
