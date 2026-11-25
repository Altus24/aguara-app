import Link from "next/link";

import { PhonePreview } from "@/components/landing/phone-preview";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";

export function Hero() {
  return (
    <section id="inicio" className="relative overflow-hidden scroll-mt-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(243,112,33,0.16),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(244,228,208,0.7),transparent_45%)]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:pt-20">
        <div>
          <p className="text-sm font-medium text-aguara-orange">Identificación con QR</p>
          <h1 className="mt-4 max-w-xl text-balance text-4xl font-semibold tracking-tight text-aguara-ink sm:text-5xl sm:leading-[1.08]">
            Identificación inteligente para tu mascota
          </h1>
          <p className="mt-5 max-w-lg text-pretty text-lg leading-8 text-stone-600">
            Escaneás el QR del collar y quien la encuentre te contacta al toque. Registrás tutor y
            mascota en minutos, vinculás varias mascotas al mismo perfil y no pagás cuotas
            mensuales.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/comprar" className={primaryButtonClass}>
              Comprar identificador QR
            </Link>
            <Link href="/tutor/registro" className={secondaryButtonClass}>
              Registrar mascota gratis
            </Link>
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm text-stone-500">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-aguara-orange" aria-hidden>
              <path
                fill="currentColor"
                d="M3 7h13l3 5v6h-2.2a2.5 2.5 0 0 1-4.6 0H9.8a2.5 2.5 0 0 1-4.6 0H3V7zm2 2v4h9.4l1.8-3H5zm2.5 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm9 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"
              />
            </svg>
            Envío a domicilio o retiro en clínicas adheridas
          </p>
          <p className="mt-3 text-sm text-stone-500">
            ¿Ya tenés el QR?{" "}
            <a href="#comprar" className="font-medium text-aguara-orange hover:text-aguara-orange-deep">
              Ver compra online
            </a>{" "}
            o{" "}
            <Link
              href="/tutor/registro"
              className="font-medium text-aguara-orange hover:text-aguara-orange-deep"
            >
              registrá mascota y tutor
            </Link>
            .
          </p>
        </div>
        <PhonePreview />
      </div>
    </section>
  );
}
