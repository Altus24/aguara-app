"use client";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported() {
  if (typeof window === "undefined") return false;
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function notificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

async function getRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Este navegador no soporta notificaciones push.");
  }
  if (process.env.NODE_ENV === "development") {
    // En dev el PwaProvider desregistra el SW; hay que registrarlo igual para probar push.
    return navigator.serviceWorker.register("/sw.js");
  }
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js");
}

async function fetchVapidPublicKey() {
  const res = await fetch("/api/push/vapid-public-key");
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.publicKey) {
    throw new Error(data.error || "No se pudo obtener la clave VAPID.");
  }
  return data.publicKey;
}

/**
 * @param {{ audience: 'tutor'|'clinica', audienceId: string }} input
 */
export async function enablePushNotifications({ audience, audienceId }) {
  if (!pushSupported()) {
    throw new Error("Las notificaciones push no están disponibles en este dispositivo.");
  }
  if (!audienceId) throw new Error("Falta el destinatario de la suscripción.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Permiso de notificaciones bloqueado en el navegador."
        : "No se otorgó permiso para notificaciones.",
    );
  }

  const registration = await getRegistration();
  await navigator.serviceWorker.ready;

  const publicKey = await fetchVapidPublicKey();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = subscription.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audience,
      audienceId,
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No se pudo guardar la suscripción push.");
  }
  return { subscription, permission: "granted" };
}

export async function disablePushNotifications() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription?.();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  try {
    await subscription.unsubscribe();
  } catch {
    /* ignore */
  }
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}

export async function hasActivePushSubscription() {
  if (!pushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const sub = await registration?.pushManager?.getSubscription?.();
    return Boolean(sub);
  } catch {
    return false;
  }
}

export function iosPushHint() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(navigator.standalone);
  return isIos && !standalone;
}
