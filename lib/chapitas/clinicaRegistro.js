export const CLINICA_ESTADO_PENDIENTE = "pendiente";
export const CLINICA_ESTADO_APROBADA = "aprobada";
export const CLINICA_ESTADO_RECHAZADA = "rechazada";

/** Clínicas sin columna/migración se tratan como aprobadas. */
export function clinicaEstaAprobada(clinica) {
  const estado = String(clinica?.estado_registro || CLINICA_ESTADO_APROBADA).toLowerCase();
  return estado === CLINICA_ESTADO_APROBADA;
}

export function clinicaEstaPendiente(clinica) {
  return (
    String(clinica?.estado_registro || "").toLowerCase() === CLINICA_ESTADO_PENDIENTE
  );
}

export function clinicaEstaRechazada(clinica) {
  return (
    String(clinica?.estado_registro || "").toLowerCase() === CLINICA_ESTADO_RECHAZADA
  );
}

export function etiquetaEstadoRegistro(estado) {
  const value = String(estado || CLINICA_ESTADO_APROBADA).toLowerCase();
  if (value === CLINICA_ESTADO_PENDIENTE) return "Pendiente";
  if (value === CLINICA_ESTADO_RECHAZADA) return "Rechazada";
  return "Aprobada";
}

/** Plazo informativo de revisión (días). */
export const PLAZO_APROBACION_DIAS = 3;
