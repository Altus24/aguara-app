import { Link2, QrCode, Smartphone, UserRound } from "lucide-react";

const steps = [
  {
    icon: QrCode,
    title: "Escaneá el QR",
    body: "El collar abre la chapita en Aguará. Si está libre, aparece el formulario de registro.",
  },
  {
    icon: UserRound,
    title: "Registrá al tutor",
    body: "Cargás nombre, email y teléfono una sola vez. Si ya existe, lo buscás y lo reutilizás.",
  },
  {
    icon: Link2,
    title: "Vinculá la mascota",
    body: "Cada chapita guarda una mascota. Varias mascotas pueden quedar linkeadas al mismo tutor.",
  },
  {
    icon: Smartphone,
    title: "Perfil listo",
    body: "Quien escanee ve la ficha, el contacto del tutor y, si hay, las otras mascotas de la familia.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-20 border-t border-stone-200/80">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <p className="text-sm font-medium text-aguara-orange">Cómo funciona</p>
        <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight text-aguara-ink sm:text-4xl">
          Del QR al registro: tutor y mascotas en la app.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
          Un tutor, varias mascotas. La segunda chapita no vuelve a pedir todos los datos: buscás el
          tutor y solo cargás el animal nuevo.
        </p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <article
              key={step.title}
              className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-[0_18px_40px_-28px_rgba(26,19,17,0.35)]"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-aguara-cream text-aguara-orange">
                  <step.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium text-stone-400">0{index + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-aguara-ink">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
