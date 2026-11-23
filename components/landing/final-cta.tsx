import Link from "next/link";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";

export function FinalCta() {
  return (
    <section id="empezar" className="scroll-mt-20 border-t border-stone-200/80">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="overflow-hidden rounded-[2rem] bg-aguara-ink px-6 py-12 text-center text-white sm:px-12 sm:py-16">
          <p className="text-sm font-medium text-aguara-cream">Listo para empezar</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Conseguí la chapita Aguará
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-7 text-white/70 sm:text-base">
            Activá el perfil de tu mascota y quedate tranquilo. Si ya tenés el QR, registralo en
            minutos.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/mascota/T1-001" className={primaryButtonClass}>
              Conseguir Aguará
            </Link>
            <Link href="/tutor/login" className={secondaryButtonClass}>
              Soy tutor
            </Link>
            <Link
              href="/clinica/registro"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/25 bg-transparent px-5 text-sm font-medium text-white transition hover:border-white/50 hover:bg-white/10"
            >
              Registrá tu clínica
            </Link>
          </div>
          <p className="mt-6 text-sm text-white/55">
            Si encontrás una mascota,{" "}
            <span className="font-medium text-aguara-cream">escaneá el QR</span>.
          </p>
        </div>
      </div>
    </section>
  );
}
