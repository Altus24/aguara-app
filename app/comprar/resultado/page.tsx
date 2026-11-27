import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LandingFooter } from "@/components/landing/footer";
import { LandingHeader } from "@/components/landing/header";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";

export const metadata: Metadata = {
  title: "Resultado de la compra",
};

export const instant = false;

type SearchParams = Promise<{ status?: string; payment_id?: string; collection_status?: string }>;

async function ResultadoContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = String(params.status || params.collection_status || "").toLowerCase();

  let title = "Pago en proceso";
  let body =
    "Mercado Pago aún no confirmó el pago. Te avisamos cuando se acredite. Si ya pagaste, podés cerrar esta ventana.";
  let tone: "ok" | "warn" | "bad" = "warn";

  if (status === "success" || status === "approved") {
    title = "¡Pago aprobado!";
    body =
      "Gracias por tu compra. Vamos a preparar tu Identificador QR Pasador. Te contactamos con el seguimiento del envío o el retiro.";
    tone = "ok";
  } else if (status === "failure" || status === "rejected" || status === "null") {
    title = "El pago no se completó";
    body =
      "No se acreditó el pago. Podés intentar de nuevo o elegir otro medio en Mercado Pago.";
    tone = "bad";
  }

  const box =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : tone === "bad"
        ? "border-red-200 bg-red-50 text-red-950"
        : "border-amber-200 bg-amber-50 text-amber-950";

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <div className={`rounded-2xl border px-6 py-8 ${box}`}>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-7 opacity-90">{body}</p>
        {params.payment_id ? (
          <p className="mt-4 text-xs opacity-70">Ref. pago: {params.payment_id}</p>
        ) : null}
      </div>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {tone === "bad" ? (
          <Link href="/comprar" className={primaryButtonClass}>
            Reintentar compra
          </Link>
        ) : (
          <Link href="/tutor/registro" className={primaryButtonClass}>
            Registrar mascota
          </Link>
        )}
        <Link href="/" className={secondaryButtonClass}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

export default function ComprarResultadoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <LandingHeader />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="mx-auto max-w-lg px-6 py-16 text-center text-sm text-stone-500">
              Cargando resultado…
            </div>
          }
        >
          <ResultadoContent searchParams={searchParams} />
        </Suspense>
      </main>
      <LandingFooter />
    </div>
  );
}
