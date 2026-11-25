/** Catálogo de compra online del Identificador QR Pasador. */

export const PRODUCTO_NOMBRE = "Identificador QR Pasador Aguará";
export const PRECIO_IDENTIFICADOR_ARS = 5000;
export const PRECIO_ENVIO_ARS = 5000;
/** Envío gratis a partir de esta cantidad (Gran Mendoza). */
export const ENVIO_GRATIS_DESDE = 5;

export const TALLES = [
  {
    id: "S",
    label: "Talle S",
    descripcion: "Recomendado para Gatos / Cintas 10-15mm",
  },
  {
    id: "M",
    label: "Talle M",
    descripcion: "Perros Chicos / Cintas 15-22mm",
  },
  {
    id: "L",
    label: "Talle L",
    descripcion: "Perros Medianos y Grandes / Cintas 25-30mm",
  },
];

export const ENTREGAS = [
  {
    id: "retiro",
    label: "Retiro en Comercio Adherido",
    descripcion: "Gratis — Junín, San Martín, Godoy Cruz",
    costo: 0,
  },
  {
    id: "envio",
    label: "Envío a Domicilio",
    descripcion: `$5.000 Gran Mendoza — GRATIS en ${ENVIO_GRATIS_DESDE}+ unidades`,
    costo: PRECIO_ENVIO_ARS,
  },
];

export const PAGOS = [
  {
    id: "transferencia",
    label: "Transferencia Bancaria",
    descripcion: "Te mostramos los datos al confirmar en Mercado Pago",
    icon: "bank",
  },
  {
    id: "qr_debito",
    label: "Pago QR / Débito",
    descripcion: "Mercado Pago, QR o tarjeta de débito",
    icon: "qr",
  },
  {
    id: "cuotas",
    label: "3 Cuotas Sin Interés",
    descripcion: "Con tarjeta de crédito vía Mercado Pago",
    icon: "cuotas",
  },
];

export function formatArs(n) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

/**
 * @param {{ talleId: string, entregaId: string, cantidad?: number }} opts
 */
export function calcularTotales({ talleId, entregaId, cantidad = 1 }) {
  const talle = TALLES.find((t) => t.id === talleId) || TALLES[0];
  const entrega = ENTREGAS.find((e) => e.id === entregaId) || ENTREGAS[0];
  const qty = Math.max(1, Math.min(20, Number(cantidad) || 1));
  const subtotal = PRECIO_IDENTIFICADOR_ARS * qty;
  let envio = 0;
  if (entrega.id === "envio") {
    envio = qty >= ENVIO_GRATIS_DESDE ? 0 : PRECIO_ENVIO_ARS;
  }
  return {
    talle,
    entrega,
    cantidad: qty,
    subtotal,
    envio,
    total: subtotal + envio,
  };
}
