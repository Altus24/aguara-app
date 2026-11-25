import { NextResponse } from "next/server";

import { PAGOS, TALLES, ENTREGAS } from "@/lib/ecommerce/catalog";
import { crearPreferenciaCheckout } from "@/lib/ecommerce/mercadopago";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const talleId = String(body.talleId || "").toUpperCase();
    const entregaId = String(body.entregaId || "");
    const pagoId = String(body.pagoId || "");
    const cantidad = Number(body.cantidad) || 1;

    if (!TALLES.some((t) => t.id === talleId)) {
      return NextResponse.json({ error: "Elegí un talle válido." }, { status: 400 });
    }
    if (!ENTREGAS.some((e) => e.id === entregaId)) {
      return NextResponse.json({ error: "Elegí una opción de entrega." }, { status: 400 });
    }
    if (!PAGOS.some((p) => p.id === pagoId)) {
      return NextResponse.json({ error: "Elegí un método de pago." }, { status: 400 });
    }

    const pref = await crearPreferenciaCheckout({
      talleId,
      entregaId,
      pagoId,
      cantidad,
    });

    return NextResponse.json({
      ok: true,
      initPoint: pref.initPoint,
      preferenceId: pref.id,
      total: pref.total,
    });
  } catch (err) {
    console.error("[api/ecommerce/checkout]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "No se pudo iniciar el pago con Mercado Pago.",
      },
      { status: 500 },
    );
  }
}
