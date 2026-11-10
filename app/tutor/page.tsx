import type { Metadata } from "next";
import { Suspense } from "react";

import TutorPanel from "@/components/chapitas/TutorPanel";

export const metadata: Metadata = {
  title: "Mi cuenta",
};

export default function TutorPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-stone-500">
          Cargando…
        </div>
      }
    >
      <TutorPanel />
    </Suspense>
  );
}
