import { NextResponse } from "next/server";

import { upsertPushSubscription } from "@/lib/chapitas/webPush";

export async function POST(request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400 });
    }

    const audience = body.audience === "clinica" ? "clinica" : "tutor";
    const audienceId = String(body.audienceId || body.audience_id || "").trim();
    const endpoint = String(body.endpoint || body.subscription?.endpoint || "").trim();
    const keys = body.keys || body.subscription?.keys || {};
    const p256dh = String(keys.p256dh || "").trim();
    const auth = String(keys.auth || "").trim();

    if (!audienceId || !endpoint || !p256dh || !auth) {
      return NextResponse.json({ ok: false, error: "datos_incompletos" }, { status: 400 });
    }

    const row = await upsertPushSubscription({
      audience,
      audienceId,
      endpoint,
      p256dh,
      auth,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, subscription: row });
  } catch (error) {
    console.error("[api/push/subscribe]", error);
    const message = error instanceof Error ? error.message : "error";
    const status = /Falta la tabla|42_push/i.test(message) ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
