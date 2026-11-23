import { NextResponse } from "next/server";

import { getClientIpFromHeaders } from "@/lib/chapitas/geoIp";
import { registrarEscaneoChapita } from "@/lib/chapitas/registrarEscaneo";

export async function POST(request: Request) {
  try {
    let body: { mascotaId?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400 });
    }

    const mascotaId = typeof body.mascotaId === "string" ? body.mascotaId.trim() : "";
    if (!mascotaId) {
      return NextResponse.json({ ok: false, error: "mascota_id_requerido" }, { status: 400 });
    }

    const ip = getClientIpFromHeaders(request.headers);
    const userAgent = request.headers.get("user-agent");

    const result = await registrarEscaneoChapita({
      mascotaId,
      ip,
      userAgent,
    });

    if (!result.ok) {
      const status = result.error?.includes("40_chapita_escaneos")
        ? 503
        : result.error === "mascota_no_encontrada"
          ? 404
          : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/chapitas/escaneo]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "error_interno",
      },
      { status: 500 },
    );
  }
}
