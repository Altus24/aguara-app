import { Check } from "lucide-react";
import Link from "next/link";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";

const tutorItems = [
  "Contacto inmediato por WhatsApp o llamada cuando alguien escanea el QR",
  "Posibilidad de compartir ubicación de quien la encontró",
  "Enfermedades y medicación a la vista (si las cargás)",
  "Recordatorios de vacunas y desparasitación",
  "Historial clínico en un solo lugar",
  "Turnos online en clínicas de la red Aguará",
  "App instalable en el celular",
];

const clinicaItems = [
  "Citas del día y lista de espera",
  "Historias clínicas completas",
  "Vacunas, desparasitaciones y archivos",
  "Recordatorios automáticos al tutor",
  "Vínculo directo con tutores Aguará",
  "Solicitud de permiso para ver la historia completa",
];

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-6 text-stone-600">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-aguara-cream text-aguara-orange">
            <Check className="size-3" strokeWidth={3} aria-hidden="true" />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Audiences() {
  return (
    <section id="audiencias" className="scroll-mt-20 border-t border-stone-200/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-20 sm:py-24 lg:grid-cols-2">
        <article
          id="tutores"
          className="scroll-mt-20 rounded-3xl border border-stone-200/80 bg-white p-8 shadow-[0_18px_40px_-28px_rgba(26,19,17,0.35)] sm:p-10"
        >
          <p className="text-sm font-medium text-aguara-orange">Para tutores</p>
          <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-aguara-ink sm:text-3xl">
            Todo lo que necesitás para cuidarla (y recuperarla)
          </h2>
          <FeatureList items={tutorItems} />
          <Link href="/tutor/login" className={`${primaryButtonClass} mt-8`}>
            Soy tutor · Activá tu chapita
          </Link>
        </article>

        <article
          id="clinicas"
          className="scroll-mt-20 rounded-3xl border border-stone-200/80 bg-aguara-paper p-8 sm:p-10"
        >
          <p className="text-sm font-medium text-aguara-orange">Para clínicas</p>
          <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-aguara-ink sm:text-3xl">
            Agenda, pacientes e historias clínicas en un solo panel
          </h2>
          <FeatureList items={clinicaItems} />
          <Link href="/clinica/registro" className={`${secondaryButtonClass} mt-8`}>
            Registrá tu clínica
          </Link>
        </article>
      </div>
    </section>
  );
}
