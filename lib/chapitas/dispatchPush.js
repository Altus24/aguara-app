/**
 * Dispara Web Push sin bloquear el flujo principal (cliente o servidor).
 * @param {{ audience: 'tutor'|'clinica', audienceId: string, title: string, body?: string, url?: string, tag?: string }} payload
 */
export function dispatchPushNotification(payload) {
  try {
    const audience = payload?.audience === "clinica" ? "clinica" : "tutor";
    const audienceId = String(payload?.audienceId || "").trim();
    const title = String(payload?.title || "").trim();
    if (!audienceId || !title) return;

    const body = {
      audience,
      audienceId,
      title,
      body: payload.body || "",
      url: payload.url || (audience === "clinica" ? "/clinica" : "/tutor"),
      tag: payload.tag || undefined,
    };

    // En servidor: envío directo (VAPID privado). En cliente: API.
    if (typeof window === "undefined") {
      import("@/lib/chapitas/webPush")
        .then(({ sendPushToAudience }) => sendPushToAudience(body))
        .catch((err) => console.warn("[dispatchPush]", err?.message || err));
      return;
    }

    fetch("/api/push/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch((err) => console.warn("[dispatchPush]", err?.message || err));
  } catch (err) {
    console.warn("[dispatchPush]", err?.message || err);
  }
}
