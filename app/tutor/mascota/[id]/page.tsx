import type { Metadata } from "next";
import { Suspense } from "react";

import TutorMascotaPerfil from "@/components/tutor/TutorMascotaPerfil";

export const metadata: Metadata = {
  title: "Mi mascota",
};

export const instant = false;

export default function TutorMascotaPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-stone-500">
          Cargando…
        </div>
      }
    >
      <TutorMascotaPerfil />
    </Suspense>
  );
}
