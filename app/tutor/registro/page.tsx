import type { Metadata } from "next";
import { Suspense } from "react";

import TutorRegistro from "@/components/tutor/TutorRegistro";

export const metadata: Metadata = {
  title: "Registrar tutor",
};

export default function TutorRegistroPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-stone-500">
          Cargando…
        </div>
      }
    >
      <TutorRegistro />
    </Suspense>
  );
}
