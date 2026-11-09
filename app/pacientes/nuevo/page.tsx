import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { NewPatient } from "@/components/patients/new-patient";
import { FormSkeleton } from "@/components/patients/skeletons";
import { SetupRequired } from "@/components/patients/states";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Nuevo paciente",
};

export default function NuevoPacientePage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired />;
  }

  return (
    <div className="max-w-2xl">
      <Link href="/pacientes" className="text-sm text-stone-500 hover:text-stone-950">
        ← Pacientes
      </Link>
      <h1 className="mt-4 text-2xl font-medium tracking-tight text-stone-950">Nuevo paciente</h1>
      <p className="mt-1 text-sm text-stone-500">
        El tutor y la mascota se guardan en Supabase.
      </p>
      <div className="mt-6">
        <Suspense fallback={<FormSkeleton />}>
          <NewPatient />
        </Suspense>
      </div>
    </div>
  );
}
