import { sendNotification, setVapidDetails } from "web-push";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase no configurado para Web Push.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function ensureVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:soporte@aguara.app";
  if (!publicKey || !privateKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY y/o VAPID_PRIVATE_KEY.",
    );
  }
  setVapidDetails(subject, publicKey, privateKey);
  return { publicKey, privateKey, subject };
}

export function getVapidPublicKey() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
  }
  return publicKey;
}

/**
 * @param {{ audience: 'tutor'|'clinica', audienceId: string, endpoint: string, p256dh: string, auth: string, userAgent?: string|null }} input
 */
export async function upsertPushSubscription(input) {
  const audience = input.audience === "clinica" ? "clinica" : "tutor";
  const audienceId = String(input.audienceId || "").trim();
  const endpoint = String(input.endpoint || "").trim();
  const p256dh = String(input.p256dh || "").trim();
  const auth = String(input.auth || "").trim();
  if (!audienceId || !endpoint || !p256dh || !auth) {
    throw new Error("Suscripción incompleta.");
  }

  const supabase = getSupabaseAdmin();
  const row = {
    audience,
    audience_id: audienceId,
    endpoint,
    p256dh,
    auth,
    user_agent: input.userAgent ? String(input.userAgent).slice(0, 400) : null,
    actualizado_en: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(row, { onConflict: "endpoint" })
    .select("id, audience, audience_id, endpoint")
    .single();

  if (error) {
    if (/push_subscriptions|schema cache|does not exist/i.test(error.message || "")) {
      throw new Error(
        "Falta la tabla push_subscriptions. Ejecutá supabase/chapitas/42_push_subscriptions.sql.",
      );
    }
    throw new Error(error.message || "No se pudo guardar la suscripción.");
  }
  return data;
}

export async function deletePushSubscriptionByEndpoint(endpoint) {
  const ep = String(endpoint || "").trim();
  if (!ep) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", ep);
  if (error && !/push_subscriptions|schema cache|does not exist/i.test(error.message || "")) {
    throw new Error(error.message || "No se pudo eliminar la suscripción.");
  }
}

/**
 * Envía Web Push a todas las suscripciones del destinatario.
 * @param {{ audience: 'tutor'|'clinica', audienceId: string, title: string, body?: string, url?: string, tag?: string }} payload
 */
export async function sendPushToAudience(payload) {
  const audience = payload.audience === "clinica" ? "clinica" : "tutor";
  const audienceId = String(payload.audienceId || "").trim();
  const title = String(payload.title || "").trim() || "Aguará";
  if (!audienceId) return { sent: 0, failed: 0 };

  ensureVapid();
  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("audience", audience)
    .eq("audience_id", audienceId);

  if (error) {
    if (/push_subscriptions|schema cache|does not exist/i.test(error.message || "")) {
      return { sent: 0, failed: 0, skipped: "no_table" };
    }
    throw new Error(error.message || "No se pudieron leer suscripciones.");
  }

  const list = rows || [];
  if (!list.length) return { sent: 0, failed: 0 };

  const body = JSON.stringify({
    title,
    body: String(payload.body || "").trim(),
    url:
      payload.url ||
      (audience === "clinica" ? "/clinica" : "/tutor"),
    tag: payload.tag || `aguara-${audience}-${audienceId}`,
  });

  let sent = 0;
  let failed = 0;
  const staleEndpoints = [];

  await Promise.all(
    list.map(async (sub) => {
      try {
        await sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          {
            TTL: 60 * 60,
            urgency: "high",
          },
        );
        sent += 1;
      } catch (err) {
        failed += 1;
        const status = err?.statusCode || err?.status;
        if (status === 404 || status === 410) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    }),
  );

  if (staleEndpoints.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  return { sent, failed, cleaned: staleEndpoints.length };
}
