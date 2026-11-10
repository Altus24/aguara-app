import type { Metadata } from "next";
import { Suspense } from "react";

import ClinicaPanel from "@/components/clinica/ClinicaPanel";

export const metadata: Metadata = {
  title: "Panel clínica",
};

export default function ClinicaPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-stone-500">
          Cargando…
        </div>
      }
    >
      <ClinicaPanel />
    </Suspense>
  );
}
