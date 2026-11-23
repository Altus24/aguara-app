import { Suspense } from "react";

import FichaMascota from "@/components/chapitas/FichaMascota";

// Ruta corta para QR impresos (misma ficha que /mascota/...).
export const instant = false;

function QrFallback() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-stone-500">
      Cargando identificador…
    </div>
  );
}

export default function QrCortaPage() {
  return (
    <Suspense fallback={<QrFallback />}>
      <FichaMascota />
    </Suspense>
  );
}
