"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Field,
  cardClass,
  fieldClass,
  formatDate,
  formatDateTime,
  primaryBtnClass,
} from "@/components/tutor/ui";
import { confirmEliminar, confirmGuardar } from "@/lib/confirmAction";
import {
  diasHastaFecha,
  enVentanaRecordatorio,
  etiquetaDiasVencimiento,
} from "@/lib/chapitas/recordatoriosVentana";
import {
  crearRecordatorioTutor,
  eliminarRecordatorioTutor,
  historialClinicoTutor,
  listarCitasTutor,
  listarMascotasTutorCompletas,
} from "@/lib/chapitas/tutorPortal";

function fechaSortKey(value) {
  if (!value) return "9999-12-31";
  return String(value).slice(0, 10);
}

export default function RecordatoriosSection({ tutor }) {
  const [data, setData] = useState({
    mascotas: [],
    vacunas: [],
    desparasitaciones: [],
    recordatorios: [],
    consultas: [],
    citasProximas: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const [hist, pets, citas] = await Promise.all([
        historialClinicoTutor(tutor.id, tutor.email),
        listarMascotasTutorCompletas(tutor.id, tutor.email),
        listarCitasTutor(tutor.id, tutor.email),
      ]);
      setData({
        ...hist,
        mascotas: pets.mascotas || hist.mascotas || [],
        citasProximas: citas.proximas || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar recordatorios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [hist, pets, citas] = await Promise.all([
          historialClinicoTutor(tutor.id, tutor.email),
          listarMascotasTutorCompletas(tutor.id, tutor.email),
          listarCitasTutor(tutor.id, tutor.email),
        ]);
        if (cancelled) return;
        setData({
          ...hist,
          mascotas: pets.mascotas || hist.mascotas || [],
          citasProximas: citas.proximas || [],
        });
        // Dispara push de vencimientos ≤7 días (dedupe diario en el server).
        fetch(
          `/api/cron/recordatorios-vencimiento?tutorId=${encodeURIComponent(tutor.id)}`,
          { method: "POST", keepalive: true },
        ).catch(() => {});
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

  const vacunasProx = (data.vacunas || []).filter((v) =>
    enVentanaRecordatorio(v.proxima_fecha),
  );
  const desparasProx = (data.desparasitaciones || []).filter((d) =>
    enVentanaRecordatorio(d.proxima_fecha),
  );
  const controles = (data.recordatorios || []).filter(
    (r) => r.tipo === "control" && enVentanaRecordatorio(r.fecha_proxima),
  );
  const medicacion = (data.recordatorios || []).filter(
    (r) => r.tipo === "medicacion" && enVentanaRecordatorio(r.fecha_proxima),
  );
  const otros = (data.recordatorios || []).filter(
    (r) =>
      r.tipo !== "control" &&
      r.tipo !== "medicacion" &&
      enVentanaRecordatorio(r.fecha_proxima),
  );

  const timeline = useMemo(() => {
    const rows = [];
    for (const v of vacunasProx) {
      const dias = diasHastaFecha(v.proxima_fecha);
      rows.push({
        id: `vac-${v.origen || "c"}-${v.id}`,
        tipo: "Vacuna",
        title: `${v.mascota_nombre || v.clinica_pacientes?.nombre || "Mascota"} · ${v.nombre}`,
        date: v.proxima_fecha,
        diasLabel: etiquetaDiasVencimiento(dias),
        sort: fechaSortKey(v.proxima_fecha),
      });
    }
    for (const d of desparasProx) {
      const dias = diasHastaFecha(d.proxima_fecha);
      rows.push({
        id: `desp-${d.id}`,
        tipo: "Desparasitación",
        title: `${d.mascota_nombre || d.clinica_pacientes?.nombre || "Mascota"} · ${d.producto}`,
        date: d.proxima_fecha,
        diasLabel: etiquetaDiasVencimiento(dias),
        sort: fechaSortKey(d.proxima_fecha),
      });
    }
    for (const r of [...controles, ...medicacion, ...otros]) {
      const dias = diasHastaFecha(r.fecha_proxima);
      rows.push({
        id: `rec-${r.origen || "c"}-${r.id}`,
        tipo: r.tipo === "medicacion" ? "Medicación" : r.tipo === "control" ? "Control" : "Recordatorio",
        title: `${r.mascota_nombre || r.clinica_pacientes?.nombre || "Mascota"} · ${r.titulo}`,
        date: r.fecha_proxima,
        diasLabel: etiquetaDiasVencimiento(dias),
        detail: r.detalle,
        sort: fechaSortKey(r.fecha_proxima),
      });
    }
    for (const c of data.citasProximas || []) {
      const inicio = c.inicio ? String(c.inicio).slice(0, 10) : null;
      if (!enVentanaRecordatorio(inicio)) continue;
      const dias = diasHastaFecha(inicio);
      rows.push({
        id: `cita-${c.id}`,
        tipo: "Cita",
        title: `${c.clinica_pacientes?.nombre || "Mascota"} · ${c.clinicas?.nombre || "Clínica"}`,
        date: c.inicio,
        dateLabel: c.inicio ? formatDateTime(c.inicio) : null,
        diasLabel: etiquetaDiasVencimiento(dias),
        detail: c.motivo || null,
        sort: fechaSortKey(c.inicio),
      });
    }
    return rows.sort((a, b) => a.sort.localeCompare(b.sort));
  }, [vacunasProx, desparasProx, controles, medicacion, otros, data.citasProximas, hoy]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-aguara-ink">Recordatorios</h2>
        <p className="text-sm text-stone-500">
          Vencimientos de los próximos 7 días. Te avisamos por push con los días restantes.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <p className="text-sm text-stone-500">Cargando…</p> : null}

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Próximos 7 días</h3>
        {!loading && timeline.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">
            No hay vencimientos en la próxima semana.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {timeline.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-aguara-orange">
                    {item.tipo}
                  </p>
                  <p className="font-medium text-aguara-ink">{item.title}</p>
                  {item.detail ? <p className="text-stone-500">{item.detail}</p> : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium text-aguara-ink">
                    {item.diasLabel || "—"}
                  </p>
                  <p className="text-stone-600">
                    {item.dateLabel || (item.date ? formatDate(String(item.date).slice(0, 10)) : "—")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ReminderCard
          title="Vacunas (próximos 7 días)"
          empty="Sin vacunas por vencer esta semana."
          items={vacunasProx.map((v) => ({
            id: `${v.origen || "clinica"}-${v.id}`,
            title: `${v.mascota_nombre || v.clinica_pacientes?.nombre || "Mascota"} · ${v.nombre}`,
            date: v.proxima_fecha,
            diasLabel: etiquetaDiasVencimiento(diasHastaFecha(v.proxima_fecha)),
            origen: v.origen,
          }))}
        />
        <ReminderCard
          title="Desparasitaciones (próximos 7 días)"
          empty="Sin desparasitaciones por vencer esta semana."
          items={desparasProx.map((d) => ({
            id: d.id,
            title: `${d.mascota_nombre || d.clinica_pacientes?.nombre || "Mascota"} · ${d.producto}`,
            date: d.proxima_fecha,
            diasLabel: etiquetaDiasVencimiento(diasHastaFecha(d.proxima_fecha)),
            detail: "Caducidad / próxima dosis",
          }))}
        />
        <ReminderCard
          title="Controles (próximos 7 días)"
          empty="Sin controles por vencer esta semana."
          items={controles.map((r) => ({
            id: `${r.origen || "clinica"}-${r.id}`,
            title: `${r.mascota_nombre || r.clinica_pacientes?.nombre || "Mascota"} · ${r.titulo}`,
            date: r.fecha_proxima,
            diasLabel: etiquetaDiasVencimiento(diasHastaFecha(r.fecha_proxima)),
            detail: r.detalle,
            origen: r.origen,
          }))}
        />
        <MedicacionCard
          tutor={tutor}
          mascotas={data.mascotas || []}
          items={medicacion}
          onChanged={reload}
          onError={setError}
        />
      </div>
    </div>
  );
}

function origenLabel(origen) {
  if (origen === "tutor") return "cargado por vos";
  if (origen === "clinica") return "cargado por la clínica";
  return null;
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
              {origenLabel(item.origen) ? (
                <p className="text-xs text-stone-500">{origenLabel(item.origen)}</p>
              ) : null}
              {item.diasLabel ? (
                <p className="font-medium text-aguara-orange">{item.diasLabel}</p>
              ) : null}
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

function MedicacionCard({ tutor, mascotas, items, onChanged, onError }) {
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    mascota_key: "",
    titulo: "",
    detalle: "",
    fecha_proxima: "",
  });

  const pets = useMemo(
    () => (mascotas || []).filter((m) => m.chapita_id || m.paciente_clinico_id),
    [mascotas],
  );
  const unicaMascotaKey =
    pets.length === 1 ? pets[0].chapita_id || pets[0].paciente_clinico_id : "";

  useEffect(() => {
    if (unicaMascotaKey) {
      setForm((f) => (f.mascota_key ? f : { ...f, mascota_key: unicaMascotaKey }));
    }
  }, [unicaMascotaKey]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!tutor?.id) return;
    const pet = pets.find(
      (m) => (m.chapita_id || m.paciente_clinico_id) === form.mascota_key,
    );
    if (!pet) {
      onError("Elegí una mascota.");
      return;
    }
    if (!(await confirmGuardar(`la medicación “${form.titulo.trim()}”`))) return;
    setSaving(true);
    setMessage("");
    onError("");
    try {
      await crearRecordatorioTutor(tutor.id, {
        mascota_id: pet.chapita_id || null,
        paciente_id: pet.paciente_clinico_id || null,
        tipo: "medicacion",
        titulo: form.titulo,
        detalle: form.detalle,
        fecha_proxima: form.fecha_proxima || null,
      });
      setForm({
        mascota_key: pets.length === 1 ? pets[0].chapita_id || pets[0].paciente_clinico_id : "",
        titulo: "",
        detalle: "",
        fecha_proxima: "",
      });
      setMessage("Medicación agregada.");
      setShowAdd(false);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo guardar la medicación.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cardClass}>
      <h3 className="font-semibold text-aguara-ink">Medicación</h3>
      <p className="mt-1 text-sm text-stone-500">
        Podés cargarla vos o la clínica desde la historia clínica.
      </p>

      {!items?.length ? (
        <p className="mt-3 text-sm text-stone-500">Sin medicación activa.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((r) => (
            <li
              key={`${r.origen || "clinica"}-${r.id}`}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-aguara-cream/40 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-aguara-ink">
                  {r.mascota_nombre || r.clinica_pacientes?.nombre || "Mascota"} · {r.titulo}
                </p>
                <p className="text-xs text-stone-500">
                  {r.origen === "tutor" ? "cargado por vos" : "cargado por la clínica"}
                </p>
                {r.fecha_proxima ? (
                  <>
                    <p className="font-medium text-aguara-orange">
                      {etiquetaDiasVencimiento(diasHastaFecha(r.fecha_proxima))}
                    </p>
                    <p className="text-stone-600">Fecha: {formatDate(r.fecha_proxima)}</p>
                  </>
                ) : null}
                {r.detalle ? <p className="text-stone-500">{r.detalle}</p> : null}
              </div>
              {r.origen === "tutor" && tutor?.id ? (
                <button
                  type="button"
                  className="text-xs text-stone-500 underline"
                  onClick={async () => {
                    if (!(await confirmEliminar(`la medicación “${r.titulo}”`))) return;
                    try {
                      await eliminarRecordatorioTutor(tutor.id, r.id);
                      await onChanged();
                    } catch (err) {
                      onError(
                        err instanceof Error ? err.message : "No se pudo eliminar la medicación.",
                      );
                    }
                  }}
                >
                  Quitar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {pets.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">
          Primero registrá una mascota para poder cargar medicación.
        </p>
      ) : (
        <>
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-aguara-orange hover:underline"
            aria-expanded={showAdd}
            onClick={() => {
              setShowAdd((v) => !v);
              setMessage("");
              onError("");
            }}
          >
            <span
              aria-hidden
              className={`inline-block transition-transform ${showAdd ? "rotate-90" : ""}`}
            >
              ›
            </span>
            {showAdd ? "Ocultar formulario" : "Agregar medicación"}
          </button>

          {showAdd ? (
            <form onSubmit={handleSubmit} className="mt-3 grid gap-3">
              <Field label="Mascota" id="rec-med-mascota">
                <select
                  id="rec-med-mascota"
                  required
                  className={fieldClass}
                  value={form.mascota_key}
                  onChange={(e) => setForm((f) => ({ ...f, mascota_key: e.target.value }))}
                >
                  <option value="">Elegí una mascota</option>
                  {pets.map((m) => (
                    <option
                      key={m.chapita_id || m.paciente_clinico_id}
                      value={m.chapita_id || m.paciente_clinico_id}
                    >
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Medicación" id="rec-med-titulo">
                <input
                  id="rec-med-titulo"
                  required
                  className={fieldClass}
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Nombre del medicamento"
                />
              </Field>
              <Field label="Detalle / indicaciones" id="rec-med-det">
                <input
                  id="rec-med-det"
                  className={fieldClass}
                  value={form.detalle}
                  onChange={(e) => setForm((f) => ({ ...f, detalle: e.target.value }))}
                  placeholder="Dosis, frecuencia… (opcional)"
                />
              </Field>
              <Field label="Próxima fecha / hasta" id="rec-med-fecha">
                <input
                  id="rec-med-fecha"
                  type="date"
                  className={fieldClass}
                  value={form.fecha_proxima}
                  onChange={(e) => setForm((f) => ({ ...f, fecha_proxima: e.target.value }))}
                />
              </Field>
              <button type="submit" disabled={saving} className={primaryBtnClass}>
                {saving ? "…" : "Agregar medicación"}
              </button>
            </form>
          ) : null}
        </>
      )}

      {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
    </div>
  );
}
