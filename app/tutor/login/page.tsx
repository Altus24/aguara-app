import type { Metadata } from "next";
import { Suspense } from "react";

import TutorLogin from "@/components/chapitas/TutorLogin";

export const metadata: Metadata = {
  title: "Ingreso tutores",
};

export default function TutorLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-stone-500">
          Cargando…
        </div>
      }
    >
      <TutorLogin />
    </Suspense>
  );
}
