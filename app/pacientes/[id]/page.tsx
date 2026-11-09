import type { Metadata } from "next";
import { Suspense } from "react";

import { PatientFile } from "@/components/patients/patient-file";
import { DetailSkeleton } from "@/components/patients/skeletons";
import { SetupRequired } from "@/components/patients/states";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Ficha clínica",
};

export default function PacientePage({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) {
    return <SetupRequired />;
  }

  return (
    <Suspense fallback={<DetailSkeleton />}>
      <PatientFile params={params} />
    </Suspense>
  );
}
