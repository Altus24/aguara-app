/** Catálogo de especialidades veterinarias (selección + opción libre). */
export const ESPECIALIDADES_VET = [
  "Clínica general",
  "Cirugía",
  "Traumatología",
  "Cardiología",
  "Dermatología",
  "Oftalmología",
  "Neurología",
  "Oncología",
  "Odontología",
  "Anestesiología",
  "Diagnóstico por imágenes",
  "Laboratorio clínico",
  "Medicina felina",
  "Medicina de animales exóticos",
  "Animales de granja / producción",
  "Etología / comportamiento",
  "Reproducción",
  "Nutrición",
  "Urgencias y cuidados intensivos",
];

export const ESPECIALIDAD_OTRA = "__otra__";

export function opcionesEspecialidad(extras = []) {
  const set = new Set(ESPECIALIDADES_VET);
  for (const extra of extras) {
    const t = String(extra || "").trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export function valorSelectEspecialidad(especialidad, opciones) {
  const t = String(especialidad || "").trim();
  if (!t) return "";
  if (opciones.includes(t)) return t;
  return ESPECIALIDAD_OTRA;
}
