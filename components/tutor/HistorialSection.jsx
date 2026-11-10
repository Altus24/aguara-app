"use client";

import { useEffect, useState } from "react";

import { cardClass, formatDate, formatDateTime, primaryBtnClass, secondaryBtnClass } from "@/components/tutor/ui";
import {
  buildConsultaText,
  buildHistorialText,
  downloadTextFile,
  historialClinicoTutor,
} from "@/lib/chapitas/tutorPortal";

export default function HistorialSection({ tutor }) {
  const [data, setData] = useState({
    consultas: [],
    vacunas: [],
    desparasitaciones: [],
    archivos: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const hist = await historialClinicoTutor(tutor.id, tutor.email);
        if (!cancelled) setData(hist);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el historial.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tutor.id, tutor.email]);

  function descargarTodo() {
    const text = buildHistorialText({
      tutor,
      consultas: data.consultas,
      vacunas: data.vacunas,
      desparasitaciones: data.desparasitaciones,
      archivos: data.archivos,
    });
    downloadTextFile(`historial-clinico-${tutor.email}.txt`, text);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-aguara-ink">Historial clínico</h2>
          <p className="text-sm text-stone-500">
            Consultas, tratamientos, vacunas, desparasitaciones y archivos
          </p>
        </div>
        <button type="button" className={primaryBtnClass} onClick={descargarTodo} disabled={loading}>
          Descargar historial completo
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Consultas anteriores</h3>
        {loading ? (
          <p className="mt-3 text-sm text-stone-500">Cargando…</p>
        ) : data.consultas.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">
            Todavía no hay consultas compartidas por tu clínica.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {data.consultas.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-aguara-ink">
                      {c.clinica_pacientes?.nombre || "Mascota"} · {formatDateTime(c.fecha)}
                    </p>
                    <p className="text-sm text-stone-600">Motivo: {c.motivo || "—"}</p>
                    <p className="text-sm text-stone-600">
                      Diagnóstico: {c.diagnostico || "—"}
                    </p>
                    {c.tratamiento ? (
                      <p className="text-sm text-stone-600">Tratamiento: {c.tratamiento}</p>
                    ) : null}
                    {c.medicacion ? (
                      <p className="text-sm text-stone-600">Indicaciones / medicación: {c.medicacion}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={secondaryBtnClass}
                    onClick={() =>
                      downloadTextFile(
                        `consulta-${c.clinica_pacientes?.nombre || "mascota"}-${String(c.fecha).slice(0, 10)}.txt`,
                        buildConsultaText(c),
                      )
                    }
                  >
                    Descargar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={cardClass}>
          <h3 className="font-semibold text-aguara-ink">Vacunas</h3>
          {data.vacunas.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Sin vacunas registradas.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.vacunas.map((v) => (
                <li key={v.id}>
                  <strong>{v.clinica_pacientes?.nombre}</strong> · {v.nombre} · {formatDate(v.fecha)}
                  {v.proxima_fecha ? ` · próxima ${formatDate(v.proxima_fecha)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={cardClass}>
          <h3 className="font-semibold text-aguara-ink">Desparasitaciones</h3>
          {data.desparasitaciones.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Sin registros.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.desparasitaciones.map((d) => (
                <li key={d.id}>
                  <strong>{d.clinica_pacientes?.nombre}</strong> · {d.producto} ·{" "}
                  {formatDate(d.fecha)}
                  {d.proxima_fecha ? ` · próxima ${formatDate(d.proxima_fecha)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Estudios y archivos</h3>
        {data.archivos.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Sin archivos compartidos.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {data.archivos.map((a) => (
              <li key={a.id}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-aguara-orange hover:underline"
                >
                  {a.nombre}
                </a>{" "}
                <span className="text-stone-500">
                  ({a.tipo}) · {a.clinica_pacientes?.nombre} · {formatDateTime(a.creado_en)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
