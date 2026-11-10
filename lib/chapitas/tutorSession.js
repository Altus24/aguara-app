const STORAGE_KEY = "aguara_tutor_session_v1";

export function normalizeTutorEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export function readTutorSession() {
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

export function writeTutorSession(tutor) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      id: tutor.id,
      email: tutor.email,
      nombre_completo: tutor.nombre_completo,
      telefono: tutor.telefono ?? null,
      telefono_secundario: tutor.telefono_secundario ?? null,
      direccion: tutor.direccion ?? null,
      clinica_preferida_id: tutor.clinica_preferida_id ?? null,
    }),
  );
}

export function clearTutorSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
