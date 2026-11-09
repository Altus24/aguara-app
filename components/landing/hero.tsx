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
            Un QR en el collar conecta a quien la encuentre con su perfil, el tutor y la ficha
            médica. Sin cuotas mensuales y con registro en segundos.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/mascota/T1-001" className={primaryButtonClass}>
              Conseguir Aguará
            </Link>
            <a href="#como-funciona" className={secondaryButtonClass}>
              Ver cómo funciona
            </a>
          </div>
          <p className="mt-5 text-sm text-stone-500">
            ¿Ya tenés el QR? Escanealo o abrí{" "}
            <Link
              href="/mascota/T1-001"
              className="font-medium text-aguara-orange hover:text-aguara-orange-deep"
            >
              el formulario en blanco
            </Link>{" "}
            y registrá mascota y dueño.
          </p>
        </div>
        <PhonePreview />
      </div>
    </section>
  );
}
