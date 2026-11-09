import { Suspense } from "react";

import FichaMascota from "@/components/chapitas/FichaMascota";

function MascotaFallback() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-stone-500">
      Cargando chapita…
    </div>
  );
}

export default function MascotaPage() {
  return (
    <Suspense fallback={<MascotaFallback />}>
      <FichaMascota />
    </Suspense>
  );
}
