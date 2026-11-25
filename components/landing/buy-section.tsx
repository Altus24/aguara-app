import Link from "next/link";

import ComprarFlow from "@/components/ecommerce/ComprarFlow";
import { formatArs, PRECIO_IDENTIFICADOR_ARS } from "@/lib/ecommerce/catalog";
import { secondaryButtonClass } from "@/components/ui/form";

export function BuySection() {
  return (
    <section id="comprar" className="scroll-mt-20 border-t border-stone-200/80 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-aguara-orange">Compra online</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-aguara-ink sm:text-4xl">
            Comprar tu Identificador QR Pasador
          </h2>
          <p className="mt-4 text-pretty text-sm leading-7 text-stone-600 sm:text-base">
            Elegí talle, entrega y medio de pago. El checkout lo cierra Mercado Pago de forma
            segura. Desde {formatArs(PRECIO_IDENTIFICADOR_ARS)}.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl rounded-[1.75rem] border border-stone-200 bg-aguara-paper/60 p-5 shadow-[0_20px_50px_-36px_rgba(28,25,23,0.45)] sm:p-8">
          <ComprarFlow compact />
        </div>

        <p className="mt-6 text-center text-sm text-stone-500">
          ¿Preferís verlo a pantalla completa?{" "}
          <Link href="/comprar" className="font-medium text-aguara-orange hover:underline">
            Abrir /comprar
          </Link>
        </p>

        <div className="mt-8 flex justify-center">
          <Link href="/tutor/registro" className={secondaryButtonClass}>
            Ya tengo el QR — registrar mascota
          </Link>
        </div>
      </div>
    </section>
  );
}
