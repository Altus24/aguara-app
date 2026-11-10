const STORAGE_KEY = "aguara_clinic_session_v1";

export function normalizeClinicEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export function readClinicSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeClinicSession(clinica) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      id: clinica.id,
      email: clinica.email,
      nombre: clinica.nombre,
      telefono: clinica.telefono ?? null,
      direccion: clinica.direccion ?? "",
      ciudad: clinica.ciudad ?? "",
      provincia: clinica.provincia ?? "",
      descripcion: clinica.descripcion ?? null,
      maps_url: clinica.maps_url ?? null,
      permite_citas_tutor: clinica.permite_citas_tutor !== false,
    }),
  );
}

export function clearClinicSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
