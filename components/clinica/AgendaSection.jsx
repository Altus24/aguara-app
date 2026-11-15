"use client";

import { useEffect, useMemo, useState } from "react";

import {
  cardClass,
  EstadoBadge,
  Field,
  fieldClass,
  formatDateTime,
  formatTime,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/clinica/ui";
import {
  CITA_ESTADOS,
  addDaysISO,
  actualizarCita,
  cambiarEstadoCita,
  crearCita,
  endOfDayISO,
  etiquetaEstado,
  listarCitasRango,
  listarClientes,
  listarEspera,
  listarPacientes,
  listarVeterinarios,
  startOfDayISO,
} from "@/lib/chapitas/clinicaOps";
import { listarServicios } from "@/lib/chapitas/clinicas";

export default function AgendaSection({ clinicaId }) {
  const [day, setDay] = useState(() => new Date());
  const [vetId, setVetId] = useState("");
  const [vets, setVets] = useState([]);
  const [citas, setCitas] = useState([]);
  const [espera, setEspera] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const dayLabel = useMemo(
    () =>
      day.toLocaleDateString("es-AR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }),
    [day],
  );

  async function reload(currentDay = day, currentVet = vetId) {
    setLoading(true);
    setError("");
    try {
      const [v, c, e, p, cl, s] = await Promise.all([
        listarVeterinarios(clinicaId),
        listarCitasRango(
          clinicaId,
          startOfDayISO(currentDay),
          endOfDayISO(currentDay),
          currentVet || undefined,
        ),
        listarEspera(clinicaId),
        listarPacientes(clinicaId),
        listarClientes(clinicaId),
        listarServicios(clinicaId),
      ]);
      setVets(v);
      setCitas(c);
      setEspera(e);
      setPacientes(p);
      setClientes(cl);
      setServicios(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la agenda.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId]);

  function shiftDay(delta) {
    const next = addDaysISO(day, delta);
    setDay(next);
    reload(next, vetId);
  }

  async function onEstado(id, estado) {
    try {
      await cambiarEstadoCita(id, estado);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-aguara-ink">Agenda / Citas</h2>
          <p className="text-sm capitalize text-stone-500">{dayLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryBtnClass} onClick={() => shiftDay(-1)}>
            ← Día
          </button>
          <button
            type="button"
            className={secondaryBtnClass}
            onClick={() => {
              const today = new Date();
              setDay(today);
              reload(today, vetId);
            }}
          >
            Hoy
          </button>
          <button type="button" className={secondaryBtnClass} onClick={() => shiftDay(1)}>
            Día →
          </button>
          <button
            type="button"
            className={primaryBtnClass}
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            Nueva cita
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setVetId("");
            reload(day, "");
          }}
          className={`rounded-full px-3 py-1.5 text-sm ${!vetId ? "bg-aguara-orange text-white" : "bg-stone-100 text-stone-700"}`}
        >
          Todos los vets
        </button>
        {vets.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setVetId(v.id);
              reload(day, v.id);
            }}
            className={`rounded-full px-3 py-1.5 text-sm ${vetId === v.id ? "bg-aguara-orange text-white" : "bg-stone-100 text-stone-700"}`}
            style={vetId === v.id ? undefined : { borderLeft: `4px solid ${v.color}` }}
          >
            {v.nombre}
          </button>
        ))}
      </div>

      {showForm ? (
        <CitaForm
          clinicaId={clinicaId}
          pacientes={pacientes}
          clientes={clientes}
          vets={vets}
          servicios={servicios}
          initial={editing}
          defaultDay={day}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setShowForm(false);
            setEditing(null);
            await reload();
          }}
        />
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className={`${cardClass} lg:col-span-2`}>
          <h3 className="font-semibold text-aguara-ink">Calendario del día</h3>
          {loading ? (
            <p className="mt-4 text-sm text-stone-500">Cargando…</p>
          ) : citas.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">Sin citas para este día/vet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-stone-100">
              {citas.map((cita) => (
                <li key={cita.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-aguara-ink">
                        {formatTime(cita.inicio)}
                        {cita.fin ? ` – ${formatTime(cita.fin)}` : ""} ·{" "}
                        {cita.clinica_pacientes?.nombre || "Sin paciente"}
                      </p>
                      <p className="text-sm text-stone-500">
                        {cita.clinica_veterinarios?.nombre || "Sin vet"} ·{" "}
                        {cita.clinica_clientes?.nombre_completo || "—"}
                        {cita.motivo ? ` · ${cita.motivo}` : ""}
                      </p>
                    </div>
                    <EstadoBadge estado={cita.estado} label={etiquetaEstado(cita.estado)} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CITA_ESTADOS.filter((e) => e.id !== "lista_espera").map((estado) => (
                      <button
                        key={estado.id}
                        type="button"
                        disabled={cita.estado === estado.id}
                        onClick={() => onEstado(cita.id, estado.id)}
                        className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-600 hover:border-aguara-orange hover:text-aguara-orange disabled:opacity-40"
                      >
                        {estado.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-600 hover:border-aguara-orange"
                      onClick={() => {
                        setEditing(cita);
                        setShowForm(true);
                      }}
                    >
                      Reprogramar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-aguara-ink">Lista de espera</h3>
            <button
              type="button"
              className="text-sm text-aguara-orange"
              onClick={() => {
                setEditing({ estado: "lista_espera" });
                setShowForm(true);
              }}
            >
              + Agregar
            </button>
          </div>
          {espera.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">Vacía.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {espera.map((cita) => (
                <li key={cita.id} className="rounded-xl bg-aguara-cream/40 p-3">
                  <p className="font-medium text-aguara-ink">
                    {cita.clinica_pacientes?.nombre || "Sin paciente"}
                  </p>
                  <p className="text-sm text-stone-500">
                    {cita.clinica_clientes?.nombre_completo || "—"} ·{" "}
                    {etiquetaEstado(cita.estado)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs text-aguara-orange underline"
                      onClick={() => onEstado(cita.id, "en_espera")}
                    >
                      Pasar a espera
                    </button>
                    <button
                      type="button"
                      className="text-xs text-aguara-orange underline"
                      onClick={() => {
                        setEditing(cita);
                        setShowForm(true);
                      }}
                    >
                      Asignar turno
                    </button>
                    <button
                      type="button"
                      className="text-xs text-stone-500 underline"
                      onClick={() => onEstado(cita.id, "cancelada")}
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CitaForm({
  clinicaId,
  pacientes,
  clientes,
  vets,
  servicios,
  initial,
  defaultDay,
  onCancel,
  onSaved,
}) {
  const defaultStart = new Date(defaultDay);
  if (!initial?.inicio) {
    defaultStart.setHours(10, 0, 0, 0);
  }
  const [form, setForm] = useState({
    paciente_id: initial?.paciente_id || "",
    cliente_id: initial?.cliente_id || "",
    veterinario_id: initial?.veterinario_id || "",
    servicio_id: initial?.servicio_id || "",
    inicio: toLocalInputValue(initial?.inicio) || toLocalInputValue(defaultStart.toISOString()),
    fin: toLocalInputValue(initial?.fin) || "",
    estado: initial?.estado || "confirmada",
    motivo: initial?.motivo || "",
    notas: initial?.notas || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function onPacienteChange(pacienteId) {
    const paciente = pacientes.find((p) => p.id === pacienteId);
    setForm((f) => ({
      ...f,
      paciente_id: pacienteId,
      cliente_id: paciente?.cliente_id || f.cliente_id,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        paciente_id: form.paciente_id || null,
        cliente_id: form.cliente_id || null,
        veterinario_id: form.veterinario_id || null,
        servicio_id: form.servicio_id || null,
        inicio: form.estado === "lista_espera" ? null : new Date(form.inicio).toISOString(),
        fin: form.fin ? new Date(form.fin).toISOString() : null,
        estado: form.estado,
        motivo: form.motivo,
        notas: form.notas,
      };
      if (initial?.id) {
        await actualizarCita(initial.id, payload);
      } else {
        await crearCita(clinicaId, payload);
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la cita.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-3`}>
      <h3 className="font-semibold text-aguara-ink">
        {initial?.id ? "Reprogramar / editar cita" : "Nueva cita"}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Paciente" id="cita-pac">
          <select
            id="cita-pac"
            className={fieldClass}
            value={form.paciente_id}
            onChange={(e) => onPacienteChange(e.target.value)}
          >
            <option value="">Seleccionar…</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.clinica_clientes?.nombre_completo || "—"})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cliente" id="cita-cli">
          <select
            id="cita-cli"
            className={fieldClass}
            value={form.cliente_id}
            onChange={(e) => setForm((f) => ({ ...f, cliente_id: e.target.value }))}
          >
            <option value="">Seleccionar…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre_completo}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Veterinario" id="cita-vet">
          <select
            id="cita-vet"
            className={fieldClass}
            value={form.veterinario_id}
            onChange={(e) => setForm((f) => ({ ...f, veterinario_id: e.target.value }))}
          >
            <option value="">Sin asignar</option>
            {vets.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Servicio" id="cita-srv">
          <select
            id="cita-srv"
            className={fieldClass}
            value={form.servicio_id}
            onChange={(e) => setForm((f) => ({ ...f, servicio_id: e.target.value }))}
          >
            <option value="">Sin servicio</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Inicio" id="cita-ini">
          <input
            id="cita-ini"
            type="datetime-local"
            className={fieldClass}
            value={form.inicio}
            onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value }))}
            disabled={form.estado === "lista_espera"}
          />
        </Field>
        <Field label="Fin" id="cita-fin">
          <input
            id="cita-fin"
            type="datetime-local"
            className={fieldClass}
            value={form.fin}
            onChange={(e) => setForm((f) => ({ ...f, fin: e.target.value }))}
            disabled={form.estado === "lista_espera"}
          />
        </Field>
        <Field label="Estado" id="cita-est">
          <select
            id="cita-est"
            className={fieldClass}
            value={form.estado}
            onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
          >
            {CITA_ESTADOS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Motivo" id="cita-mot">
          <input
            id="cita-mot"
            className={fieldClass}
            value={form.motivo}
            onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
          />
        </Field>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={primaryBtnClass}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" className={secondaryBtnClass} onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <p className="text-xs text-stone-400">Última edición: {formatDateTime(initial?.creado_en)}</p>
    </form>
  );
}
