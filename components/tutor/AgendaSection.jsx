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
import { confirmAccion, confirmGuardar } from "@/lib/confirmAction";
import { etiquetaEstado, etiquetaEstadoCitaTutor } from "@/lib/chapitas/clinicaOps";
import {
  VET_SEGUN_DISPONIBILIDAD,
  cancelarCitaTutor,
  listarCitasTutor,
  listarClinicasParaTurnos,
  listarHorariosYOcupacion,
  listarMascotasTutorCompletas,
  listarSlotsSegunDisponibilidad,
  listarVeterinariosParaTurnos,
  otorgarCompartirHcTutor,
  solicitarTurnoTutor,
  tutorTienePermisoHcConClinica,
} from "@/lib/chapitas/tutorPortal";

const ESTADOS_ACCIONABLES_TUTOR = new Set(["pendiente", "confirmada", "lista_espera"]);

export default function AgendaSection({ tutor, prefill = null, onPrefillConsumed }) {
  const [proximas, setProximas] = useState([]);
  const [pasadas, setPasadas] = useState([]);
  const [mascotas, setMascotas] = useState([]);
  const [clinicas, setClinicas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [prefMascotaId, setPrefMascotaId] = useState(null);
  const [histExpandido, setHistExpandido] = useState(false);
  const [accionId, setAccionId] = useState("");

  const permiteSolicitar = clinicas.length > 0;
  const pasadasVisibles = histExpandido ? pasadas : pasadas.slice(0, 1);
  const pasadasOcultas = Math.max(0, pasadas.length - 1);

  async function handleCancelar(cita) {
    const cuando = cita.inicio ? formatDateTime(cita.inicio) : "esta cita";
    if (
      !(await confirmAccion(
        `¿Cancelar la cita del ${cuando}? La clínica verá el turno como cancelado.`,
      ))
    ) {
      return;
    }
    setAccionId(cita.id);
    setError("");
    try {
      await cancelarCitaTutor(tutor.id, tutor.email, cita.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar la cita.");
    } finally {
      setAccionId("");
    }
  }

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

  useEffect(() => {
    if (!prefill?.openForm && !prefill?.mascotaId) return;
    if (loading) return;
    if (!permiteSolicitar || mascotas.length === 0) {
      onPrefillConsumed?.();
      return;
    }
    setPrefMascotaId(prefill.mascotaId || null);
    setEditing(null);
    setShowForm(Boolean(prefill.openForm));
    onPrefillConsumed?.();
  }, [prefill, loading, permiteSolicitar, mascotas.length, onPrefillConsumed]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-aguara-ink">Mis citas</h2>
        <p className="text-sm text-stone-500">
          Pedí turno en cualquier clínica del sistema, dentro de sus horarios
        </p>
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
          preferMascotaId={prefMascotaId}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
            setPrefMascotaId(null);
          }}
          onSaved={async () => {
            setShowForm(false);
            setEditing(null);
            setPrefMascotaId(null);
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-aguara-ink">Próximas citas</h3>
          {permiteSolicitar && mascotas.length > 0 ? (
            <button
              type="button"
              className={`${primaryBtnClass} w-full sm:w-auto`}
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              Sacar turno
            </button>
          ) : null}
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-stone-500">Cargando…</p>
        ) : proximas.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">No tenés citas próximas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {proximas.map((cita) => {
              const accionable = ESTADOS_ACCIONABLES_TUTOR.has(cita.estado);
              return (
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
                          A confirmar por la clínica
                        </p>
                      ) : null}
                    </div>
                    <EstadoBadge estado={cita.estado} label={etiquetaEstado(cita.estado)} />
                  </div>
                  {accionable ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={secondaryBtnClass}
                        disabled={Boolean(accionId) || !permiteSolicitar}
                        onClick={() => {
                          setEditing(cita);
                          setShowForm(true);
                          requestAnimationFrame(() => {
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          });
                        }}
                      >
                        Reprogramar
                      </button>
                      <button
                        type="button"
                        className={secondaryBtnClass}
                        disabled={Boolean(accionId)}
                        onClick={() => handleCancelar(cita)}
                      >
                        {accionId === cita.id ? "…" : "Cancelar"}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Historial de citas</h3>
        <p className="mt-1 text-sm text-stone-500">
          El resultado (Realizada / No asistió / Cancelada) lo define la clínica.
        </p>
        {loading ? (
          <p className="mt-3 text-sm text-stone-500">Cargando…</p>
        ) : pasadas.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Sin citas pasadas.</p>
        ) : (
          <div className="mt-3">
            <ul className="divide-y divide-stone-100">
              {pasadasVisibles.map((cita) => {
                const label = etiquetaEstadoCitaTutor(cita);
                const badgeEstado =
                  label === "Por confirmar asistencia"
                    ? "pendiente"
                    : cita.estado === "finalizada"
                      ? "finalizada"
                      : cita.estado;
                return (
                  <li
                    key={cita.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
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
                    <EstadoBadge estado={badgeEstado} label={label} />
                  </li>
                );
              })}
            </ul>
            {pasadasOcultas > 0 ? (
              <button
                type="button"
                className="mt-2 text-sm font-medium text-aguara-orange hover:underline"
                onClick={() => setHistExpandido((v) => !v)}
              >
                {histExpandido
                  ? "Ver menos"
                  : `Ver más (${pasadasOcultas} anterior${pasadasOcultas === 1 ? "" : "es"})`}
              </button>
            ) : null}
          </div>
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

function CitaForm({ tutor, mascotas, clinicas, initial, preferMascotaId, onCancel, onSaved }) {
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
  const [compartirHc, setCompartirHc] = useState(true);
  const [yaTienePermisoHc, setYaTienePermisoHc] = useState(false);
  const [checkingPermisoHc, setCheckingPermisoHc] = useState(false);

  const clinicaSeleccionada = useMemo(
    () => clinicas.find((c) => c.id === form.clinica_id),
    [clinicas, form.clinica_id],
  );

  const mascotaSeleccionada = useMemo(
    () => mascotas.find((m) => m.key === form.paciente_key) || null,
    [mascotas, form.paciente_key],
  );

  const mostrarCheckHc =
    !initial?.id && Boolean(form.clinica_id) && Boolean(mascotaSeleccionada?.chapita_id);

  useEffect(() => {
    if (initial?.paciente_id) {
      const m = mascotas.find((x) => x.paciente_clinico_id === initial.paciente_id);
      if (m) {
        setForm((f) => ({
          ...f,
          paciente_key: m.key,
          clinica_id:
            initial?.clinica_id ||
            m.clinica_cabecera_id ||
            f.clinica_id ||
            defaultClinica,
        }));
      }
    } else if (preferMascotaId) {
      const m = mascotas.find((x) => x.chapita_id === preferMascotaId);
      if (m) {
        setForm((f) => ({
          ...f,
          paciente_key: m.key,
          clinica_id: f.clinica_id || m.clinica_cabecera_id || defaultClinica,
        }));
      }
    } else if (mascotas.length === 1) {
      const m = mascotas[0];
      setForm((f) => ({
        ...f,
        paciente_key: m.key,
        clinica_id: f.clinica_id || m.clinica_cabecera_id || defaultClinica,
      }));
    }
  }, [initial, mascotas, defaultClinica, preferMascotaId]);

  useEffect(() => {
    let cancelled = false;
    async function checkPermiso() {
      if (initial?.id || !form.clinica_id || !tutor?.id) {
        setYaTienePermisoHc(false);
        return;
      }
      setCheckingPermisoHc(true);
      try {
        const ok = await tutorTienePermisoHcConClinica(tutor.id, form.clinica_id);
        if (cancelled) return;
        setYaTienePermisoHc(ok);
        if (!ok) setCompartirHc(true);
      } catch {
        if (!cancelled) setYaTienePermisoHc(false);
      } finally {
        if (!cancelled) setCheckingPermisoHc(false);
      }
    }
    checkPermiso();
    return () => {
      cancelled = true;
    };
  }, [form.clinica_id, tutor?.id, initial?.id]);

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
          if (f.veterinario_id === VET_SEGUN_DISPONIBILIDAD) return f;
          if (f.veterinario_id && rows.some((v) => v.id === f.veterinario_id)) return f;
          // Por defecto: según disponibilidad (si hay vets)
          return {
            ...f,
            veterinario_id: rows.length ? VET_SEGUN_DISPONIBILIDAD : "",
            hora: "",
          };
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

  const segunDisponibilidad = form.veterinario_id === VET_SEGUN_DISPONIBILIDAD;

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
        let available = [];
        if (form.veterinario_id === VET_SEGUN_DISPONIBILIDAD) {
          const data = await listarSlotsSegunDisponibilidad(form.clinica_id, form.fecha);
          available = [...data.slots];
        } else {
          const data = await listarHorariosYOcupacion(
            form.clinica_id,
            form.fecha,
            form.veterinario_id,
          );
          available = [...data.slots];
        }
        if (cancelled) return;
        if (
          initial?.id &&
          initial.inicio &&
          toDateInput(initial.inicio) === form.fecha &&
          (form.veterinario_id === VET_SEGUN_DISPONIBILIDAD ||
            !initial.veterinario_id ||
            initial.veterinario_id === form.veterinario_id)
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
              : "No se pudieron cargar los horarios disponibles.",
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
    if (!(await confirmGuardar(initial?.id ? "la reprogramación del turno" : "la solicitud de turno"))) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const mascota = mascotas.find((m) => m.key === form.paciente_key);
      if (!mascota) throw new Error("Elegí una mascota.");
      const segunDisp = form.veterinario_id === VET_SEGUN_DISPONIBILIDAD;

      if (
        !initial?.id &&
        compartirHc &&
        !yaTienePermisoHc &&
        mascota.chapita_id
      ) {
        await otorgarCompartirHcTutor({
          tutorId: tutor.id,
          clinicaId: form.clinica_id,
          mascotaId: mascota.chapita_id,
          mensaje: "Autorizado al sacar turno",
        });
      }

      await solicitarTurnoTutor({
        tutor,
        clinicaId: form.clinica_id,
        veterinarioId: segunDisp ? null : form.veterinario_id,
        segunDisponibilidad: segunDisp,
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
        Podés elegir un veterinario o “Según disponibilidad”. La clínica deberá confirmar el turno.
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
            {vets.length > 0 ? (
              <option value={VET_SEGUN_DISPONIBILIDAD}>Según disponibilidad</option>
            ) : null}
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
            onChange={(e) => {
              const key = e.target.value;
              const m = mascotas.find((x) => x.key === key);
              setForm((f) => ({
                ...f,
                paciente_key: key,
                clinica_id:
                  m?.clinica_cabecera_id &&
                  clinicas.some((c) => c.id === m.clinica_cabecera_id)
                    ? m.clinica_cabecera_id
                    : f.clinica_id,
              }));
            }}
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
                      : segunDisponibilidad
                        ? "Sin horarios libres ese día"
                        : "Sin horarios ese día para este veterinario"}
            </option>
            {slots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
          {segunDisponibilidad && form.fecha ? (
            <p className="mt-1 text-xs text-stone-500">
              Se muestran horarios libres de cualquier veterinario. Al enviar, se asigna uno
              disponible en ese horario.
            </p>
          ) : null}
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

      {mostrarCheckHc && !yaTienePermisoHc ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-aguara-orange/30 bg-aguara-cream/40 p-3 text-sm text-aguara-ink">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={compartirHc}
            disabled={checkingPermisoHc || saving}
            onChange={(e) => setCompartirHc(e.target.checked)}
          />
          <span>
            <span className="font-medium">
              Compartir el historial clínico de{" "}
              {mascotaSeleccionada?.nombre || "la mascota"} con esta clínica para la
              consulta
            </span>
            <span className="mt-0.5 block text-xs text-stone-600">
              Así la clínica puede ver antecedentes de otras atenciones. Podés quitar el
              permiso después en la pestaña Permisos.
            </span>
          </span>
        </label>
      ) : null}

      {mostrarCheckHc && yaTienePermisoHc ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Esta clínica ya tiene permiso para ver el historial clínico de{" "}
          {mascotaSeleccionada?.nombre || "tu mascota"}.
        </p>
      ) : null}

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
