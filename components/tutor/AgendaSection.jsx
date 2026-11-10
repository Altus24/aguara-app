"use client";

import { useEffect, useMemo, useState } from "react";

import {
  EstadoBadge,
  Field,
  cardClass,
  fieldClass,
  formatDateTime,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tutor/ui";
import { etiquetaEstado } from "@/lib/chapitas/clinicaOps";
import {
  listarCitasTutor,
  listarClinicasParaTurnos,
  listarHorariosYOcupacion,
  listarMascotasTutorCompletas,
  listarVeterinariosParaTurnos,
  solicitarTurnoTutor,
} from "@/lib/chapitas/tutorPortal";

export default function AgendaSection({ tutor }) {
  const [proximas, setProximas] = useState([]);
  const [pasadas, setPasadas] = useState([]);
  const [mascotas, setMascotas] = useState([]);
  const [clinicas, setClinicas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const permiteSolicitar = clinicas.length > 0;

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const [citas, pets, clinics] = await Promise.all([
        listarCitasTutor(tutor.id, tutor.email),
        listarMascotasTutorCompletas(tutor.id, tutor.email),
        listarClinicasParaTurnos(),
      ]);
      setProximas(citas.proximas);
      setPasadas(citas.pasadas);
      setMascotas(pets.mascotas);
      setClinicas(clinics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la agenda.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutor.id, tutor.email]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-aguara-ink">Mis citas</h2>
          <p className="text-sm text-stone-500">
            Pedí turno en cualquier clínica del sistema, dentro de sus horarios
          </p>
        </div>
        {permiteSolicitar && mascotas.length > 0 ? (
          <button
            type="button"
            className={primaryBtnClass}
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            Sacar turno
          </button>
        ) : null}
      </div>

      {!permiteSolicitar && !loading ? (
        <p className="text-sm text-stone-500">
          Todavía no hay clínicas disponibles para turnos online.
        </p>
      ) : null}

      {permiteSolicitar && !loading && mascotas.length === 0 ? (
        <p className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
          Para sacar un turno primero vinculá o registrá una mascota en{" "}
          <span className="font-medium text-aguara-ink">Mis mascotas</span>. Si todavía no tenés
          chapita QR, activá una desde el inicio.
        </p>
      ) : null}

      {showForm ? (
        <CitaForm
          tutor={tutor}
          mascotas={mascotas}
          clinicas={clinicas}
          initial={editing}
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

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Próximas citas</h3>
        {loading ? (
          <p className="mt-3 text-sm text-stone-500">Cargando…</p>
        ) : proximas.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">No tenés citas próximas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {proximas.map((cita) => (
              <li key={cita.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-aguara-ink">
                      {cita.clinica_pacientes?.nombre || "Mascota"} ·{" "}
                      {cita.inicio ? formatDateTime(cita.inicio) : "A coordinar"}
                    </p>
                    <p className="text-sm text-stone-500">
                      {cita.clinicas?.nombre || "Clínica"}
                      {cita.clinicas?.ciudad ? ` · ${cita.clinicas.ciudad}` : ""}
                      {cita.clinica_veterinarios?.nombre
                        ? ` · ${cita.clinica_veterinarios.nombre}`
                        : ""}
                      {cita.motivo ? ` · ${cita.motivo}` : ""}
                    </p>
                    {cita.estado === "pendiente" ? (
                      <p className="mt-1 text-xs text-amber-700">
                        Esperando confirmación de la clínica
                      </p>
                    ) : null}
                  </div>
                  <EstadoBadge estado={cita.estado} label={etiquetaEstado(cita.estado)} />
                </div>
                {permiteSolicitar &&
                ["pendiente", "confirmada", "lista_espera"].includes(cita.estado) ? (
                  <button
                    type="button"
                    className="mt-2 text-sm text-aguara-orange underline"
                    onClick={() => {
                      setEditing(cita);
                      setShowForm(true);
                    }}
                  >
                    Reprogramar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Historial de citas</h3>
        {loading ? (
          <p className="mt-3 text-sm text-stone-500">Cargando…</p>
        ) : pasadas.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Sin citas pasadas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {pasadas.map((cita) => (
              <li key={cita.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-aguara-ink">
                    {cita.clinica_pacientes?.nombre || "Mascota"} ·{" "}
                    {cita.inicio ? formatDateTime(cita.inicio) : "—"}
                  </p>
                  <p className="text-sm text-stone-500">
                    {cita.clinicas?.nombre || "Clínica"}
                    {cita.clinica_veterinarios?.nombre
                      ? ` · ${cita.clinica_veterinarios.nombre}`
                      : ""}
                    {cita.motivo ? ` · ${cita.motivo}` : ""}
                  </p>
                </div>
                <EstadoBadge estado={cita.estado} label={etiquetaEstado(cita.estado)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function toDateInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function CitaForm({ tutor, mascotas, clinicas, initial, onCancel, onSaved }) {
  const defaultClinica = tutor.clinica_preferida_id || clinicas[0]?.id || "";
  const [form, setForm] = useState({
    clinica_id: initial?.clinica_id || defaultClinica,
    veterinario_id: initial?.veterinario_id || "",
    paciente_key: "",
    fecha: toDateInput(initial?.inicio) || "",
    hora: toTimeLabel(initial?.inicio) || "",
    motivo: initial?.motivo || "",
    notas: initial?.notas || "",
  });
  const [vets, setVets] = useState([]);
  const [loadingVets, setLoadingVets] = useState(false);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const clinicaSeleccionada = useMemo(
    () => clinicas.find((c) => c.id === form.clinica_id),
    [clinicas, form.clinica_id],
  );

  useEffect(() => {
    if (initial?.paciente_id) {
      const m = mascotas.find((x) => x.paciente_clinico_id === initial.paciente_id);
      if (m) setForm((f) => ({ ...f, paciente_key: m.key }));
    } else if (mascotas.length === 1) {
      setForm((f) => ({ ...f, paciente_key: mascotas[0].key }));
    }
  }, [initial, mascotas]);

  useEffect(() => {
    let cancelled = false;
    async function loadVets() {
      if (!form.clinica_id) {
        setVets([]);
        return;
      }
      setLoadingVets(true);
      try {
        const rows = await listarVeterinariosParaTurnos(form.clinica_id);
        if (cancelled) return;
        setVets(rows);
        setForm((f) => {
          if (f.veterinario_id && rows.some((v) => v.id === f.veterinario_id)) return f;
          return { ...f, veterinario_id: rows[0]?.id || "", hora: "" };
        });
      } catch (err) {
        if (!cancelled) {
          setVets([]);
          setError(err instanceof Error ? err.message : "No se pudieron cargar veterinarios.");
        }
      } finally {
        if (!cancelled) setLoadingVets(false);
      }
    }
    loadVets();
    return () => {
      cancelled = true;
    };
  }, [form.clinica_id]);

  useEffect(() => {
    let cancelled = false;
    async function loadSlots() {
      if (!form.clinica_id || !form.veterinario_id || !form.fecha) {
        setSlots([]);
        return;
      }
      setLoadingSlots(true);
      setError("");
      try {
        const data = await listarHorariosYOcupacion(
          form.clinica_id,
          form.fecha,
          form.veterinario_id,
        );
        if (cancelled) return;
        const available = [...data.slots];
        if (
          initial?.id &&
          initial.inicio &&
          toDateInput(initial.inicio) === form.fecha &&
          (!initial.veterinario_id || initial.veterinario_id === form.veterinario_id)
        ) {
          const own = toTimeLabel(initial.inicio);
          if (own && !available.includes(own)) available.push(own);
          available.sort();
        }
        setSlots(available);
        if (form.hora && !available.includes(form.hora)) {
          setForm((f) => ({ ...f, hora: "" }));
        }
      } catch (err) {
        if (!cancelled) {
          setSlots([]);
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar los horarios de ese veterinario.",
          );
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }
    loadSlots();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.clinica_id, form.veterinario_id, form.fecha, initial?.id, initial?.inicio]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const mascota = mascotas.find((m) => m.key === form.paciente_key);
      if (!mascota) throw new Error("Elegí una mascota.");
      await solicitarTurnoTutor({
        tutor,
        clinicaId: form.clinica_id,
        veterinarioId: form.veterinario_id,
        mascota,
        fecha: form.fecha,
        hora: form.hora,
        motivo: form.motivo,
        notas: form.notas,
        citaId: initial?.id || null,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-3`}>
      <h3 className="font-semibold text-aguara-ink">
        {initial?.id ? "Reprogramar turno" : "Sacar turno"}
      </h3>
      <p className="text-sm text-stone-500">
        Elegí veterinario y un horario de su agenda. La clínica deberá confirmarlo.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Clínica" id="t-cita-cli">
          <select
            id="t-cita-cli"
            required
            className={fieldClass}
            value={form.clinica_id}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                clinica_id: e.target.value,
                veterinario_id: "",
                hora: "",
              }))
            }
            disabled={Boolean(initial?.id)}
          >
            <option value="">Seleccionar…</option>
            {clinicas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.ciudad ? ` · ${c.ciudad}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Veterinario" id="t-cita-vet">
          <select
            id="t-cita-vet"
            required
            className={fieldClass}
            value={form.veterinario_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, veterinario_id: e.target.value, hora: "" }))
            }
            disabled={!form.clinica_id || loadingVets}
          >
            <option value="">
              {loadingVets
                ? "Cargando…"
                : !form.clinica_id
                  ? "Elegí una clínica"
                  : vets.length
                    ? "Seleccionar…"
                    : "Sin veterinarios"}
            </option>
            {vets.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
                {v.especialidad ? ` · ${v.especialidad}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mascota" id="t-cita-masc">
          <select
            id="t-cita-masc"
            required
            className={fieldClass}
            value={form.paciente_key}
            onChange={(e) => setForm((f) => ({ ...f, paciente_key: e.target.value }))}
          >
            <option value="">Seleccionar…</option>
            {mascotas.map((m) => (
              <option key={m.key} value={m.key}>
                {m.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha" id="t-cita-fecha">
          <input
            id="t-cita-fecha"
            type="date"
            required
            min={new Date().toISOString().slice(0, 10)}
            className={fieldClass}
            value={form.fecha}
            onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value, hora: "" }))}
          />
        </Field>
        <Field label="Horario disponible" id="t-cita-hora" className="sm:col-span-2">
          <select
            id="t-cita-hora"
            required
            className={fieldClass}
            value={form.hora}
            onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))}
            disabled={!form.veterinario_id || !form.fecha || loadingSlots}
          >
            <option value="">
              {loadingSlots
                ? "Cargando horarios…"
                : !form.veterinario_id
                  ? "Elegí un veterinario"
                  : !form.fecha
                    ? "Elegí una fecha"
                    : slots.length
                      ? "Seleccionar…"
                      : "Sin horarios ese día para este veterinario"}
            </option>
            {slots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Motivo" id="t-cita-mot" className="sm:col-span-2">
          <input
            id="t-cita-mot"
            className={fieldClass}
            value={form.motivo}
            onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
            placeholder="Control, vacunación, consulta…"
          />
        </Field>
      </div>
      {clinicaSeleccionada?.direccion ? (
        <p className="text-xs text-stone-500">
          {clinicaSeleccionada.direccion}
          {clinicaSeleccionada.telefono ? ` · ${clinicaSeleccionada.telefono}` : ""}
        </p>
      ) : null}
      <Field label="Notas" id="t-cita-notas">
        <textarea
          id="t-cita-notas"
          rows={2}
          className={fieldClass}
          value={form.notas}
          onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
        />
      </Field>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={saving || loadingSlots || loadingVets} className={primaryBtnClass}>
          {saving ? "Enviando…" : initial?.id ? "Pedir reprogramación" : "Enviar solicitud"}
        </button>
        <button type="button" className={secondaryBtnClass} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
