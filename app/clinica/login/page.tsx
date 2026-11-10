import type { Metadata } from "next";
import { Suspense } from "react";

import ClinicaLogin from "@/components/clinica/ClinicaLogin";

export const metadata: Metadata = {
  title: "Ingreso clínicas",
};

export default function ClinicaLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-stone-500">
          Cargando…
        </div>
      }
    >
      <ClinicaLogin />
    </Suspense>
  );
}
