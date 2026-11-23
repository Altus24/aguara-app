import { NextResponse } from "next/server";

import { sendPushToAudience } from "@/lib/chapitas/webPush";

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
    const title = String(body.title || body.titulo || "").trim();
    if (!audienceId || !title) {
      return NextResponse.json({ ok: false, error: "datos_incompletos" }, { status: 400 });
    }

    const result = await sendPushToAudience({
      audience,
      audienceId,
      title,
      body: body.body || body.mensaje || "",
      url: body.url || undefined,
      tag: body.tag || undefined,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/push/dispatch]", error);
    const message = error instanceof Error ? error.message : "error";
    const status = /VAPID|Falta/i.test(message) ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
