export const ANTICIPACION_OPTS = [
  { id: "15m", label: "15 minutos antes" },
  { id: "1h", label: "1 hora antes" },
  { id: "3h", label: "3 horas antes" },
  { id: "1d", label: "1 día antes" },
  { id: "2d", label: "2 días antes" },
  { id: "1w", label: "1 semana antes" },
];

export const CANAL_OPTS = [
  { id: "app", label: "App / notificación en el celular" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Mail" },
];

export function componerDireccion(parts = {}) {
  const bits = [];
  const calleNum = [parts.calle, parts.numeracion].filter(Boolean).join(" ");
  if (calleNum) bits.push(calleNum);
  if (parts.tipo_vivienda === "casa") bits.push("Casa");
  if (parts.tipo_vivienda === "edificio") {
    bits.push(parts.piso_depto ? `Edificio · ${parts.piso_depto}` : "Edificio");
  } else if (parts.piso_depto) {
    bits.push(parts.piso_depto);
  }
  if (parts.localidad) bits.push(parts.localidad);
  if (parts.provincia) bits.push(parts.provincia);
  return bits.join(", ") || null;
}

export function emptyTutorPerfilForm(tutor = {}) {
  return {
    nombre_completo: tutor.nombre_completo || "",
    telefono: tutor.telefono || "",
    telefono_secundario: tutor.telefono_secundario || "",
    clinica_preferida_id: tutor.clinica_preferida_id || "",
    calle: tutor.calle || "",
    numeracion: tutor.numeracion || "",
    tipo_vivienda: tutor.tipo_vivienda || "",
    piso_depto: tutor.piso_depto || "",
    localidad: tutor.localidad || "",
    provincia: tutor.provincia || "",
    maps_url: tutor.maps_url || "",
    notif_push_mobile: Boolean(tutor.notif_push_mobile),
    recordatorio_anticipacion: Array.isArray(tutor.recordatorio_anticipacion)
      ? [...tutor.recordatorio_anticipacion]
      : [],
    recordatorio_canales: Array.isArray(tutor.recordatorio_canales)
      ? [...tutor.recordatorio_canales]
      : ["app"],
  };
}

/**
 * Activa Web Push real para el tutor (permiso + suscripción VAPID).
 * @param {string} [tutorId]
 */
export async function pedirPermisoNotificacionesMobile(tutorId) {
  const { enablePushNotifications } = await import("@/lib/chapitas/pushClient");
  if (!tutorId) {
    throw new Error("Falta el tutor para suscribir las notificaciones push.");
  }
  await enablePushNotifications({ audience: "tutor", audienceId: tutorId });
  return "granted";
}
