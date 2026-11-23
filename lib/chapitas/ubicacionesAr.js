/**
 * Catálogo de provincias y ciudades/localidades para formularios.
 * Por ahora solo Mendoza; se puede ampliar sin cambiar la UI.
 */

export const PROVINCIAS_ACTIVAS = ["Mendoza"];

/** Departamentos / ciudades principales por provincia. */
export const CIUDADES_POR_PROVINCIA = {
  Mendoza: [
    "Capital",
    "General Alvear",
    "Godoy Cruz",
    "Guaymallén",
    "Junín",
    "La Paz",
    "Las Heras",
    "Lavalle",
    "Luján de Cuyo",
    "Maipú",
    "Malargüe",
    "Rivadavia",
    "San Carlos",
    "San Martín",
    "San Rafael",
    "Santa Rosa",
    "Tunuyán",
    "Tupungato",
  ],
};

export function provinciasDisponibles() {
  return [...PROVINCIAS_ACTIVAS];
}

export function ciudadesDeProvincia(provincia) {
  const key = String(provincia || "").trim();
  return CIUDADES_POR_PROVINCIA[key] ? [...CIUDADES_POR_PROVINCIA[key]] : [];
}

export function provinciaPorDefecto() {
  return PROVINCIAS_ACTIVAS[0] || "Mendoza";
}
