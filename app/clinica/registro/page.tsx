import type { Metadata } from "next";
import { Suspense } from "react";

import ClinicaRegistro from "@/components/clinica/ClinicaRegistro";

export const metadata: Metadata = {
  title: "Registrar clínica",
};

export default function ClinicaRegistroPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-stone-500">
          Cargando…
        </div>
      }
    >
      <ClinicaRegistro />
    </Suspense>
  );
}
