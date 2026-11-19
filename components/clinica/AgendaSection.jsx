"use client";

import { useEffect, useMemo, useState } from "react";

import {
  cardClass,
  EstadoBadge,
  Field,
  fieldClass,
  formatDateTime,
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
  listarCitasPendientes,
  listarCitasRango,
  listarClientes,
  listarEspera,
  listarPacientes,
  listarVeterinarios,
  startOfDayISO,
} from "@/lib/chapitas/clinicaOps";
import { listarHorarios, listarServicios } from "@/lib/chapitas/clinicas";
import { confirmGuardar } from "@/lib/confirmAction";
import {
  generarSlotsDeHorario,
  generarSlotsDisponibles,
  horariosDeVeterinario,
} from "@/lib/chapitas/tutorPortal";

const SLOT_MINUTES = 30;
const ROW_PX = 44;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function startOfWeekMonday(date = new Date()) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay(); // 0 domingo
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function weekDaysFrom(monday) {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i));
}

function parseMinutes(value) {
  const raw = String(value || "").slice(0, 5);
  const [h, m] = raw.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToLabel(mins) {
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
}

function citaTimeLabel(cita) {
  if (!cita?.inicio) return null;
  const d = new Date(cita.inicio);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function citaDateKey(cita) {
  if (!cita?.inicio) return null;
  return toDateKey(new Date(cita.inicio));
}

function buildTimeAxis(horarios) {
  let min = 8 * 60;
  let max = 20 * 60;
  for (const h of horarios || []) {
    if (h.activo === false) continue;
    min = Math.min(min, parseMinutes(h.hora_inicio));
    max = Math.max(max, parseMinutes(h.hora_fin));
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    min = 8 * 60;
    max = 20 * 60;
  }
  const rows = [];
  for (let t = min; t < max; t += SLOT_MINUTES) rows.push(minutesToLabel(t));
  return rows;
}

function slotTone(estado) {
  if (estado === "pendiente") {
    return "border-yellow-400 bg-yellow-200 text-yellow-950 hover:bg-yellow-300";
  }
  if (estado === "confirmada") {
    return "border-orange-400 bg-orange-200 text-orange-950 hover:bg-orange-300";
  }
  if (estado === "en_espera" || estado === "en_atencion") {
    return "border-violet-300 bg-violet-100 text-violet-950";
  }
  if (estado === "finalizada") {
    return "border-stone-300 bg-stone-100 text-stone-700";
  }
  if (estado === "cancelada" || estado === "no_asistio") {
    return "border-stone-200 bg-stone-50 text-stone-400 line-through";
  }
  return "border-stone-300 bg-white text-stone-800";
}

export default function AgendaSection({
  clinicaId,
  focusPendientes = false,
  onFocusPendientesConsumed,
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday());
  const [vetId, setVetId] = useState("");
  const [vets, setVets] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [citas, setCitas] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [espera, setEspera] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedCita, setSelectedCita] = useState(null);
  const [defaultDay, setDefaultDay] = useState(() => new Date());

  const days = useMemo(() => weekDaysFrom(weekStart), [weekStart]);
  const weekLabel = useMemo(() => {
    const from = days[0];
    const to = days[6];
    const opts = { day: "2-digit", month: "short" };
    return `${from.toLocaleDateString("es-AR", opts)} – ${to.toLocaleDateString("es-AR", {
      ...opts,
      year: "numeric",
    })}`;
  }, [days]);

  const horariosFiltrados = useMemo(() => {
    if (!vetId) {
      const propios = (horarios || []).filter((h) => h.veterinario_id);
      if (propios.length) return propios;
      return (horarios || []).filter((h) => !h.veterinario_id);
    }
    return horariosDeVeterinario(horarios, vetId);
  }, [horarios, vetId]);

  const timeAxis = useMemo(() => buildTimeAxis(horariosFiltrados.length ? horariosFiltrados : horarios), [
    horarios,
    horariosFiltrados,
  ]);

  const citasByDayTime = useMemo(() => {
    const map = new Map();
    for (const cita of citas) {
      const dayKey = citaDateKey(cita);
      const time = citaTimeLabel(cita);
      if (!dayKey || !time) continue;
      const key = `${dayKey}|${time}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(cita);
    }
    return map;
  }, [citas]);

  const scheduleSource = vetId ? horariosFiltrados : horarios;

  const scheduleByDay = useMemo(() => {
    const result = new Map();
    for (const day of days) {
      const key = toDateKey(day);
      result.set(key, new Set(generarSlotsDeHorario(scheduleSource, key, SLOT_MINUTES)));
    }
    return result;
  }, [days, scheduleSource]);

  const availableByDay = useMemo(() => {
    const result = new Map();
    for (const day of days) {
      const key = toDateKey(day);
      const dayCitas = citas.filter((c) => citaDateKey(c) === key);
      result.set(
        key,
        new Set(generarSlotsDisponibles(scheduleSource, key, dayCitas, SLOT_MINUTES)),
      );
    }
    return result;
  }, [days, citas, scheduleSource]);

  async function reload(currentWeekStart = weekStart, currentVet = vetId) {
    setLoading(true);
    setError("");
    try {
      const weekEnd = addDaysISO(currentWeekStart, 6);
      const [v, h, c, e, p, cl, s, pend] = await Promise.all([
        listarVeterinarios(clinicaId),
        listarHorarios(clinicaId),
        listarCitasRango(
          clinicaId,
          startOfDayISO(currentWeekStart),
          endOfDayISO(weekEnd),
          currentVet || undefined,
        ),
        listarEspera(clinicaId),
        listarPacientes(clinicaId),
        listarClientes(clinicaId),
        listarServicios(clinicaId),
        listarCitasPendientes(clinicaId),
      ]);
      setVets(v.filter((vet) => vet.activo !== false));
      setHorarios(h);
      setCitas(c);
      setEspera(e);
      setPacientes(p);
      setClientes(cl);
      setServicios(s);
      setPendientes(currentVet ? pend.filter((x) => x.veterinario_id === currentVet) : pend);
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

  useEffect(() => {
    if (!focusPendientes) return;
    let cancelled = false;
    (async () => {
      try {
        const pend = await listarCitasPendientes(clinicaId);
        if (cancelled) return;
        const first = pend.find((c) => c.inicio) || pend[0];
        if (first?.inicio) {
          const target = startOfWeekMonday(new Date(first.inicio));
          setWeekStart(target);
          await reload(target, vetId);
        } else {
          await reload(weekStart, vetId);
        }
        setSelectedCita(first || null);
      } catch {
        /* ignore */
      } finally {
        onFocusPendientesConsumed?.();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPendientes, clinicaId]);

  function shiftWeek(deltaWeeks) {
    const next = addDaysISO(weekStart, deltaWeeks * 7);
    setWeekStart(next);
    reload(next, vetId);
  }

  async function onEstado(id, estado) {
    try {
      await cambiarEstadoCita(id, estado);
      setSelectedCita(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    }
  }

  function openNewAt(day, timeLabel) {
    const start = new Date(day);
    const [hh, mm] = timeLabel.split(":").map(Number);
    start.setHours(hh, mm, 0, 0);
    const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
    setDefaultDay(new Date(day));
    setEditing({
      inicio: start.toISOString(),
      fin: end.toISOString(),
      veterinario_id: vetId || "",
      estado: "confirmada",
    });
    setSelectedCita(null);
    setShowForm(true);
    requestAnimationFrame(() => {
      document.getElementById("agenda-cita-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  const todayKey = toDateKey(new Date());

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-aguara-ink">Agenda / Citas</h2>
          <p className="text-sm text-stone-500">{weekLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryBtnClass} onClick={() => shiftWeek(-1)}>
            ← Semana
          </button>
          <button
            type="button"
            className={secondaryBtnClass}
            onClick={() => {
              const monday = startOfWeekMonday(new Date());
              setWeekStart(monday);
              reload(monday, vetId);
            }}
          >
            Esta semana
          </button>
          <button type="button" className={secondaryBtnClass} onClick={() => shiftWeek(1)}>
            Semana →
          </button>
          <button
            type="button"
            className={primaryBtnClass}
            onClick={() => {
              setEditing(null);
              setDefaultDay(new Date());
              setShowForm(true);
            }}
          >
            Nueva cita
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-emerald-300 ring-1 ring-emerald-500" /> Disponible
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-yellow-300 ring-1 ring-yellow-500" /> A confirmar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-orange-300 ring-1 ring-orange-500" /> Confirmado
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setVetId("");
            reload(weekStart, "");
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
              reload(weekStart, v.id);
            }}
            className={`rounded-full px-3 py-1.5 text-sm ${vetId === v.id ? "bg-aguara-orange text-white" : "bg-stone-100 text-stone-700"}`}
            style={vetId === v.id ? undefined : { borderLeft: `4px solid ${v.color || "#f97316"}` }}
          >
            {v.nombre}
          </button>
        ))}
      </div>

      {pendientes.length > 0 ? (
        <div className="rounded-2xl border border-yellow-300 bg-yellow-50 px-4 py-3">
          <p className="text-sm font-semibold text-yellow-950">
            {pendientes.length} turno{pendientes.length === 1 ? "" : "s"} por confirmar
          </p>
          <ul className="mt-2 space-y-2">
            {pendientes.slice(0, 5).map((cita) => (
              <li
                key={cita.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2"
              >
                <button
                  type="button"
                  className="text-left text-sm text-yellow-950"
                  onClick={() => {
                    if (cita.inicio) {
                      const monday = startOfWeekMonday(new Date(cita.inicio));
                      setWeekStart(monday);
                      reload(monday, vetId);
                    }
                    setSelectedCita(cita);
                  }}
                >
                  <span className="font-medium">
                    {cita.clinica_pacientes?.nombre || "Paciente"} ·{" "}
                    {cita.inicio ? formatDateTime(cita.inicio) : "Sin horario"}
                  </span>
                  <span className="mt-0.5 block text-xs text-yellow-900/80">
                    {cita.clinica_clientes?.nombre_completo || "Tutor"}
                    {cita.clinica_veterinarios?.nombre
                      ? ` · ${cita.clinica_veterinarios.nombre}`
                      : ""}
                  </span>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-full bg-orange-500 px-3 py-1 text-xs font-medium text-white"
                    onClick={() => onEstado(cita.id, "confirmada")}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-600"
                    onClick={() => onEstado(cita.id, "cancelada")}
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showForm ? (
        <div id="agenda-cita-form">
          <CitaForm
            key={editing?.id || editing?.inicio || "nueva-cita"}
            clinicaId={clinicaId}
            pacientes={pacientes}
            clientes={clientes}
            vets={vets}
            servicios={servicios}
            initial={editing}
            defaultDay={defaultDay}
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
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className={`${cardClass} overflow-hidden p-0 sm:p-0`}>
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 sm:px-5">
          <h3 className="font-semibold text-aguara-ink">Calendario semanal</h3>
          {loading ? <p className="text-sm text-stone-500">Cargando…</p> : null}
        </div>

        <div className="overflow-x-auto">
          <div
            className="min-w-[860px]"
            style={{
              display: "grid",
              gridTemplateColumns: `64px repeat(7, minmax(110px, 1fr))`,
            }}
          >
            <div className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50" />
            {days.map((day) => {
              const key = toDateKey(day);
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={`sticky top-0 z-10 border-b border-l border-stone-200 px-2 py-2 text-center ${
                    isToday ? "bg-aguara-cream" : "bg-stone-50"
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-wide text-stone-500">
                    {day.toLocaleDateString("es-AR", { weekday: "short" })}
                  </p>
                  <p
                    className={`text-sm font-semibold ${isToday ? "text-aguara-orange" : "text-aguara-ink"}`}
                  >
                    {day.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                  </p>
                </div>
              );
            })}

            {timeAxis.map((time) => (
              <div key={`row-${time}`} className="contents">
                <div
                  className="border-b border-stone-100 px-2 text-right text-[11px] text-stone-500"
                  style={{ height: ROW_PX, paddingTop: 6 }}
                >
                  {time}
                </div>
                {days.map((day) => {
                  const dayKey = toDateKey(day);
                  const cellKey = `${dayKey}|${time}`;
                  const cellCitas = citasByDayTime.get(cellKey) || [];
                  const isFree = availableByDay.get(dayKey)?.has(time);
                  const inSchedule = scheduleByDay.get(dayKey)?.has(time);

                  return (
                    <div
                      key={cellKey}
                      className={`relative border-b border-l border-stone-100 ${
                        inSchedule ? "bg-white" : "bg-stone-50/80"
                      }`}
                      style={{ height: ROW_PX }}
                    >
                      {cellCitas.length > 0 ? (
                        cellCitas.map((cita) => (
                          <button
                            key={cita.id}
                            type="button"
                            onClick={() => setSelectedCita(cita)}
                            className={`absolute inset-0.5 z-[1] overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[10px] leading-tight ${slotTone(
                              cita.estado,
                            )} ${selectedCita?.id === cita.id ? "ring-2 ring-aguara-orange" : ""}`}
                            title={`${cita.clinica_pacientes?.nombre || "Cita"} · ${etiquetaEstado(cita.estado)}`}
                          >
                            <span className="block truncate font-semibold">
                              {cita.clinica_pacientes?.nombre || "Cita"}
                            </span>
                            <span className="block truncate opacity-80">
                              {cita.clinica_veterinarios?.nombre ||
                                cita.clinica_clientes?.nombre_completo ||
                                etiquetaEstado(cita.estado)}
                            </span>
                          </button>
                        ))
                      ) : isFree ? (
                        <button
                          type="button"
                          onClick={() => openNewAt(day, time)}
                          className="absolute inset-0.5 flex items-center justify-center rounded-md border border-emerald-400 bg-emerald-200 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-300"
                          title={`Cargar cita ${time}`}
                        >
                          + Cita
                        </button>
                      ) : inSchedule ? (
                        <button
                          type="button"
                          onClick={() => openNewAt(day, time)}
                          className="absolute inset-0.5 rounded-md border border-transparent text-[10px] text-transparent hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                          title={`Cargar cita ${time}`}
                        >
                          +
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedCita ? (
        <div className={`${cardClass} border-aguara-orange/30`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-aguara-ink">
                {selectedCita.clinica_pacientes?.nombre || "Sin paciente"} ·{" "}
                {selectedCita.inicio ? formatDateTime(selectedCita.inicio) : "Sin horario"}
              </p>
              <p className="mt-1 text-sm text-stone-500">
                {selectedCita.clinica_veterinarios?.nombre || "Sin vet"} ·{" "}
                {selectedCita.clinica_clientes?.nombre_completo || "—"}
                {selectedCita.motivo ? ` · ${selectedCita.motivo}` : ""}
              </p>
            </div>
            <EstadoBadge
              estado={selectedCita.estado}
              label={etiquetaEstado(selectedCita.estado)}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedCita.estado === "pendiente" ? (
              <button
                type="button"
                className="rounded-full bg-orange-500 px-3 py-1.5 text-xs font-medium text-white"
                onClick={() => onEstado(selectedCita.id, "confirmada")}
              >
                Confirmar
              </button>
            ) : null}
            {CITA_ESTADOS.filter((e) => e.id !== "lista_espera").map((estado) => (
              <button
                key={estado.id}
                type="button"
                disabled={selectedCita.estado === estado.id}
                onClick={() => onEstado(selectedCita.id, estado.id)}
                className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-600 hover:border-aguara-orange hover:text-aguara-orange disabled:opacity-40"
              >
                {estado.label}
              </button>
            ))}
            <button
              type="button"
              className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-600 hover:border-aguara-orange"
              onClick={() => {
                setEditing(selectedCita);
                setDefaultDay(
                  selectedCita.inicio ? new Date(selectedCita.inicio) : new Date(),
                );
                setShowForm(true);
              }}
            >
              Reprogramar
            </button>
            <button
              type="button"
              className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-500"
              onClick={() => setSelectedCita(null)}
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

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
                  {cita.clinica_clientes?.nombre_completo || "—"} · {etiquetaEstado(cita.estado)}
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
    if (!(await confirmGuardar(initial?.id ? "los cambios de la cita" : "la nueva cita"))) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      let finISO = form.fin ? new Date(form.fin).toISOString() : null;
      if (!finISO && form.estado !== "lista_espera" && form.inicio) {
        finISO = new Date(
          new Date(form.inicio).getTime() + SLOT_MINUTES * 60 * 1000,
        ).toISOString();
      }
      const payload = {
        paciente_id: form.paciente_id || null,
        cliente_id: form.cliente_id || null,
        veterinario_id: form.veterinario_id || null,
        servicio_id: form.servicio_id || null,
        inicio: form.estado === "lista_espera" ? null : new Date(form.inicio).toISOString(),
        fin: finISO,
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
        {initial?.id
          ? "Reprogramar / editar cita"
          : initial?.inicio
            ? `Nueva cita · ${formatDateTime(initial.inicio)}`
            : "Nueva cita"}
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
