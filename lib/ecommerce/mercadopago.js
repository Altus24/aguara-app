import {
  PRODUCTO_NOMBRE,
  calcularTotales,
  PAGOS,
} from "@/lib/ecommerce/catalog";

function siteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProto.replace(/\/$/, "");
}

/**
 * Preferencias de métodos según la opción elegida en la UI.
 * @param {string} pagoId
 */
function paymentMethodsFor(pagoId) {
  if (pagoId === "transferencia") {
    return {
      excluded_payment_types: [
        { id: "credit_card" },
        { id: "debit_card" },
        { id: "prepaid_card" },
      ],
    };
  }
  if (pagoId === "cuotas") {
    return {
      installments: 3,
      default_installments: 3,
    };
  }
  // qr_debito: Checkout Pro completo (QR, dinero en cuenta, débito…)
  return {};
}

/**
 * Crea una preferencia de Checkout Pro y devuelve la URL de pago.
 * @param {{ talleId: string, entregaId: string, pagoId: string, cantidad?: number }} input
 */
export async function crearPreferenciaCheckout(input) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "Falta MERCADOPAGO_ACCESS_TOKEN. Configuralo en .env.local / Vercel.",
    );
  }

  const pago = PAGOS.find((p) => p.id === input.pagoId) || PAGOS[1];
  const { talle, entrega, cantidad, subtotal, envio, total } = calcularTotales({
    talleId: input.talleId,
    entregaId: input.entregaId,
    cantidad: input.cantidad,
  });

  const base = siteUrl();
  const items = [
    {
      id: `identificador-${talle.id}`,
      title: `${PRODUCTO_NOMBRE} — ${talle.label}`,
      description: talle.descripcion,
      quantity: cantidad,
      currency_id: "ARS",
      unit_price: subtotal / cantidad,
    },
  ];
  if (envio > 0) {
    items.push({
      id: "envio-domicilio",
      title: "Envío a domicilio (Gran Mendoza)",
      description: entrega.descripcion,
      quantity: 1,
      currency_id: "ARS",
      unit_price: envio,
    });
  }

  const body = {
    items,
    statement_descriptor: "AGUARA",
    external_reference: `aguara-${talle.id}-${entrega.id}-${pago.id}-${Date.now()}`,
    metadata: {
      talle: talle.id,
      entrega: entrega.id,
      pago: pago.id,
      cantidad,
      subtotal,
      envio,
      total,
    },
    back_urls: {
      success: `${base}/comprar/resultado?status=success`,
      pending: `${base}/comprar/resultado?status=pending`,
      failure: `${base}/comprar/resultado?status=failure`,
    },
    auto_return: "approved",
    payment_methods: paymentMethodsFor(pago.id),
  };

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error ||
      (Array.isArray(data?.cause) && data.cause[0]?.description) ||
      `Mercado Pago respondió ${res.status}`;
    throw new Error(String(msg));
  }

  const initPoint =
    process.env.MERCADOPAGO_USE_SANDBOX === "true"
      ? data.sandbox_init_point || data.init_point
      : data.init_point || data.sandbox_init_point;

  if (!initPoint) {
    throw new Error("Mercado Pago no devolvió URL de checkout.");
  }

  return {
    id: data.id,
    initPoint,
    total,
    talle: talle.id,
    entrega: entrega.id,
    pago: pago.id,
  };
}
