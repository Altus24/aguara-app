import { NextResponse } from "next/server";

import { avisarRecordatoriosVencimiento } from "@/lib/chapitas/avisarRecordatoriosVencimiento";

function autorizadoCron(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = request.nextUrl.searchParams.get("secret") || "";
  const cronHeader = request.headers.get("x-vercel-cron");
  return bearer === secret || query === secret || Boolean(cronHeader);
}

export async function GET(request) {
  try {
    const tutorId = request.nextUrl.searchParams.get("tutorId") || null;
    // Sin tutorId = barrido global (cron). Con tutorId = aviso solo de ese tutor (app).
    if (!tutorId && !autorizadoCron(request)) {
      return NextResponse.json({ ok: false, error: "no_autorizado" }, { status: 401 });
    }
    const result = await avisarRecordatoriosVencimiento({ tutorId });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/recordatorios-vencimiento]", error);
    const message = error instanceof Error ? error.message : "error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request) {
  return GET(request);
}
