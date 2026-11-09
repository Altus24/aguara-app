import { ClipboardPlus, Droplets, Shield, Wallet } from "lucide-react";
import Link from "next/link";

import { primaryButtonClass } from "@/components/ui/form";

const benefits = [
  {
    icon: Shield,
    title: "Seguridad total",
    body: "Si se pierde, quien la encuentra abre el perfil y avisa al tutor al instante.",
  },
  {
    icon: Wallet,
    title: "Sin cuotas mensuales",
    body: "Pagás el tag una vez. El perfil digital y el registro quedan sin abono recurrente.",
  },
  {
    icon: Droplets,
    title: "Resistente al agua",
    body: "El QR del collar aguanta el día a día: paseos, lluvia y baños.",
  },
  {
    icon: ClipboardPlus,
    title: "Ficha médica digital",
    body: "Vacunas, controles y tratamientos quedan en la historia clínica de la mascota.",
  },
];

export function Benefits() {
  return (
    <section id="beneficios" className="scroll-mt-20 border-t border-stone-200/80 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <p className="text-sm font-medium text-aguara-orange">Beneficios clave</p>
        <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-tight text-aguara-ink sm:text-4xl">
          Pensado para dueños y clínicas.
        </h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <article
              key={benefit.title}
              className="flex gap-4 rounded-2xl border border-stone-200/80 bg-aguara-paper p-6"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-aguara-orange ring-1 ring-stone-200">
                <benefit.icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-aguara-ink">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">{benefit.body}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-14 overflow-hidden rounded-3xl bg-aguara-ink px-6 py-10 text-white sm:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="text-sm font-medium text-aguara-cream">Registro por QR</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Escaneás el tag y completás el formulario en blanco.
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/70">
                Guardamos tutor y mascota en Supabase. Después, ese mismo QR abre el perfil
                público y la ficha clínica.
              </p>
            </div>
            <Link href="/mascota/T1-001" className={`${primaryButtonClass} shrink-0`}>
              Abrir formulario
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
