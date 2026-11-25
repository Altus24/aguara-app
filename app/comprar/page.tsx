import type { Metadata } from "next";
import Link from "next/link";

import ComprarFlow from "@/components/ecommerce/ComprarFlow";
import { LandingFooter } from "@/components/landing/footer";
import { LandingHeader } from "@/components/landing/header";
import { formatArs, PRECIO_IDENTIFICADOR_ARS } from "@/lib/ecommerce/catalog";

export const metadata: Metadata = {
  title: "Comprar identificador QR",
  description:
    "Comprá online el Identificador QR Pasador Aguará. Elegí talle, entrega y pagá con Mercado Pago.",
};

export default function ComprarPage() {
  return (
    <div className="flex flex-1 flex-col">
      <LandingHeader />
      <main className="flex-1 bg-[radial-gradient(circle_at_top,rgba(243,112,33,0.1),transparent_40%),linear-gradient(180deg,#fffaf5,transparent_28%)]">
        <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
          <p className="text-sm font-medium text-aguara-orange">Ecommerce Aguará</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-aguara-ink sm:text-4xl">
            Comprar tu Identificador QR Pasador
          </h1>
          <p className="mt-3 max-w-xl text-pretty text-sm leading-7 text-stone-600 sm:text-base">
            Pasador de collar con QR. Activás el perfil digital al escanearlo. Desde{" "}
            {formatArs(PRECIO_IDENTIFICADOR_ARS)}. Envío a domicilio o retiro en comercios
            adheridos.
          </p>

          <div className="mt-8 rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-40px_rgba(28,25,23,0.5)] sm:p-8">
            <ComprarFlow />
          </div>

          <p className="mt-6 text-center text-sm text-stone-500">
            ¿Ya tenés el identificador?{" "}
            <Link href="/tutor/registro" className="font-medium text-aguara-orange hover:underline">
              Registrate como tutor
            </Link>
          </p>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
