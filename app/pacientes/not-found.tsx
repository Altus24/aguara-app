import Link from "next/link";

import { primaryButtonClass } from "@/components/ui/form";

export default function PacienteNotFound() {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-8">
      <h1 className="text-2xl font-medium tracking-tight text-stone-950">
        No encontramos ese paciente
      </h1>
      <p className="mt-2 text-sm text-stone-500">
        Puede que el enlace esté incompleto o que la ficha ya no exista.
      </p>
      <Link href="/pacientes" className={`${primaryButtonClass} mt-6`}>
        Volver a pacientes
      </Link>
    </section>
  );
}
