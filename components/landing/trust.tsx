import { LockKeyhole } from "lucide-react";

export function Trust() {
  return (
    <section id="confianza" className="scroll-mt-20 border-t border-stone-200/80 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-aguara-cream text-aguara-orange">
            <LockKeyhole className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-5 text-sm font-medium text-aguara-orange">Confianza y control de datos</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-aguara-ink sm:text-4xl">
            El tutor decide qué se comparte
          </h2>
          <p className="mt-4 text-pretty text-base leading-7 text-stone-600 sm:text-lg">
            Solo quien escanea ve la ficha de esa mascota y el contacto del tutor. Las otras
            mascotas no se listan. Vos autorizás o revocás a las clínicas que pueden ver la historia
            clínica completa.
          </p>
        </div>
      </div>
    </section>
  );
}
