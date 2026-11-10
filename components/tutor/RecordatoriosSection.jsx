"use client";

import { useEffect, useMemo, useState } from "react";

import { cardClass, formatDate } from "@/components/tutor/ui";
import { historialClinicoTutor } from "@/lib/chapitas/tutorPortal";

export default function RecordatoriosSection({ tutor }) {
  const [data, setData] = useState({
    vacunas: [],
    desparasitaciones: [],
    recordatorios: [],
    consultas: [],
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
          setError(err instanceof Error ? err.message : "No se pudieron cargar recordatorios.");
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

  const hoy = new Date().toISOString().slice(0, 10);
  const en90 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().slice(0, 10);
  }, []);

  const vacunasProx = (data.vacunas || []).filter(
    (v) => v.proxima_fecha && v.proxima_fecha >= hoy && v.proxima_fecha <= en90,
  );
  const desparasProx = (data.desparasitaciones || []).filter(
    (d) => d.proxima_fecha && d.proxima_fecha >= hoy && d.proxima_fecha <= en90,
  );
  const controles = (data.recordatorios || []).filter((r) => r.tipo === "control");
  const medicacion = (data.recordatorios || []).filter((r) => r.tipo === "medicacion");
  const otros = (data.recordatorios || []).filter(
    (r) => r.tipo !== "control" && r.tipo !== "medicacion",
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-aguara-ink">Recordatorios</h2>
        <p className="text-sm text-stone-500">
          Vacunas próximas, controles y medicación cargada por la clínica
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <p className="text-sm text-stone-500">Cargando…</p> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <ReminderCard
          title="Vacunas próximas"
          empty="Sin vacunas próximas en los próximos 90 días."
          items={vacunasProx.map((v) => ({
            id: v.id,
            title: `${v.clinica_pacientes?.nombre || "Mascota"} · ${v.nombre}`,
            date: v.proxima_fecha,
          }))}
        />
        <ReminderCard
          title="Desparasitaciones próximas"
          empty="Sin desparasitaciones próximas."
          items={desparasProx.map((d) => ({
            id: d.id,
            title: `${d.clinica_pacientes?.nombre || "Mascota"} · ${d.producto}`,
            date: d.proxima_fecha,
          }))}
        />
        <ReminderCard
          title="Controles"
          empty="Sin controles programados."
          items={controles.map((r) => ({
            id: r.id,
            title: `${r.clinica_pacientes?.nombre || "Mascota"} · ${r.titulo}`,
            date: r.fecha_proxima,
            detail: r.detalle,
          }))}
        />
        <ReminderCard
          title="Medicación"
          empty="La clínica aún no cargó medicación activa."
          items={medicacion.map((r) => ({
            id: r.id,
            title: `${r.clinica_pacientes?.nombre || "Mascota"} · ${r.titulo}`,
            date: r.fecha_proxima,
            detail: r.detalle,
          }))}
        />
      </div>

      {otros.length ? (
        <ReminderCard
          title="Otros recordatorios"
          empty=""
          items={otros.map((r) => ({
            id: r.id,
            title: `${r.clinica_pacientes?.nombre || "Mascota"} · ${r.titulo}`,
            date: r.fecha_proxima,
            detail: r.detalle,
          }))}
        />
      ) : null}
    </div>
  );
}

function ReminderCard({ title, empty, items }) {
  return (
    <div className={cardClass}>
      <h3 className="font-semibold text-aguara-ink">{title}</h3>
      {!items?.length ? (
        <p className="mt-3 text-sm text-stone-500">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl bg-aguara-cream/40 px-3 py-2 text-sm">
              <p className="font-medium text-aguara-ink">{item.title}</p>
              {item.date ? (
                <p className="text-stone-600">Fecha: {formatDate(item.date)}</p>
              ) : null}
              {item.detail ? <p className="text-stone-500">{item.detail}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
