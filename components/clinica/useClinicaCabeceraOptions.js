"use client";

import { useEffect, useState } from "react";

import { obtenerClinica } from "@/lib/chapitas/clinicas";

/**
 * Opciones de “clínica de cabecera” al dar de alta desde el panel de una clínica.
 * Solo incluye la clínica actual (fresca desde DB) y fuerza el id por defecto.
 */
export default function useClinicaCabeceraOptions(
  clinicaId,
  { nombreFallback = "Esta clínica", ciudadFallback = "" } = {},
) {
  const [clinicas, setClinicas] = useState(() =>
    clinicaId
      ? [{ id: clinicaId, nombre: nombreFallback, ciudad: ciudadFallback }]
      : [],
  );

  useEffect(() => {
    if (!clinicaId) {
      setClinicas([]);
      return;
    }

    // Placeholder inmediato con el id correcto (evita IDs huérfanos en el select).
    setClinicas([
      { id: clinicaId, nombre: nombreFallback || "Esta clínica", ciudad: ciudadFallback || "" },
    ]);

    let cancelled = false;
    (async () => {
      try {
        const fresh = await obtenerClinica(clinicaId);
        if (cancelled) return;
        if (!fresh?.id) {
          // La clínica ya no existe en DB: no ofrecer opciones fantasma.
          setClinicas([]);
          return;
        }
        setClinicas([
          {
            id: fresh.id,
            nombre: fresh.nombre,
            ciudad: fresh.ciudad || "",
          },
        ]);
      } catch {
        if (!cancelled) {
          setClinicas([
            {
              id: clinicaId,
              nombre: nombreFallback || "Esta clínica",
              ciudad: ciudadFallback || "",
            },
          ]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clinicaId, nombreFallback, ciudadFallback]);

  return clinicas;
}
