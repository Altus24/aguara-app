"use client";

import { useEffect, useState } from "react";

import { listarClinicas } from "@/lib/chapitas/tutorPortal";

function normalizarOpciones(rows) {
  return (rows || [])
    .filter((c) => c?.id && String(c.nombre || "").trim())
    .map((c) => ({
      id: c.id,
      nombre: String(c.nombre).trim(),
      ciudad: c.ciudad || "",
    }));
}

/**
 * Opciones de “clínica de cabecera” al dar de alta desde el panel de una clínica.
 * Solo clínicas que existen en DB (listarClinicas). La actual va primero si sigue existiendo.
 * Nunca inventa opciones desde sesión / nombres en caché.
 */
export default function useClinicaCabeceraOptions(clinicaId) {
  const [clinicas, setClinicas] = useState([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const rows = normalizarOpciones(await listarClinicas());
        if (cancelled) return;

        if (!clinicaId) {
          setClinicas(rows);
          return;
        }

        const actual = rows.find((c) => String(c.id) === String(clinicaId));
        const resto = rows.filter((c) => String(c.id) !== String(clinicaId));
        // Si la clínica de la sesión ya no está en DB, no la ofrecemos.
        setClinicas(actual ? [actual, ...resto] : resto);
      } catch {
        if (!cancelled) setClinicas([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clinicaId]);

  return clinicas;
}
