import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PatientBrowser } from "@/components/patients/patient-browser";
import { ListSkeleton } from "@/components/patients/skeletons";
import { SetupRequired } from "@/components/patients/states";
import { primaryButtonClass } from "@/components/ui/form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Pacientes",
};

export default function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  if (!isSupabaseConfigured()) {
    return <SetupRequired />;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-stone-950">Pacientes</h1>
          <p className="mt-1 text-sm text-stone-500">
            Buscá por nombre de mascota, tutor o DNI.
          </p>
        </div>
        <Link href="/pacientes/nuevo" className={primaryButtonClass}>
          Nuevo paciente
        </Link>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <PatientBrowser searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
