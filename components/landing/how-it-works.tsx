import { MessageCircle, QrCode, Smartphone } from "lucide-react";

const steps = [
  {
    icon: QrCode,
    title: "Escaneá el QR",
    body: "Cualquier teléfono lee el tag del collar y abre el enlace de Aguará.",
  },
  {
    icon: Smartphone,
    title: "Perfil instantáneo",
    body: "Si la mascota ya está registrada, ves nombre, foto, salud y contacto del tutor.",
  },
  {
    icon: MessageCircle,
    title: "Registro o conexión",
    body: "Si el QR está vacío, aparece el formulario para cargar dueño y mascota en la base.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-20 border-t border-stone-200/80">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <p className="text-sm font-medium text-aguara-orange">Cómo funciona</p>
        <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight text-aguara-ink sm:text-4xl">
          Del collar al perfil, en tres pasos.
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
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
