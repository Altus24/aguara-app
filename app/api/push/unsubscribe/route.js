import { NextResponse } from "next/server";

import { deletePushSubscriptionByEndpoint } from "@/lib/chapitas/webPush";

export async function POST(request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400 });
    }

    const endpoint = String(body.endpoint || "").trim();
    if (!endpoint) {
      return NextResponse.json({ ok: false, error: "endpoint_requerido" }, { status: 400 });
    }

    await deletePushSubscriptionByEndpoint(endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/push/unsubscribe]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "error" },
      { status: 500 },
    );
  }
}
