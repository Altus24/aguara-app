"use client";

import { useEffect, useState } from "react";

import {
  cardClass,
  Field,
  fieldClass,
  formatDateTime,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/clinica/ui";
import {
  listarDisponibilidadVeterinario,
  validarDisponibilidadVeterinario,
} from "@/lib/chapitas/agendaDisponibilidad";
import { fechaHoraLocalDesdeValor } from "@/lib/chapitas/agendaSlots";
import {
  CITA_ESTADOS,
  actualizarCita,
  crearCita,
  crearRecordatorio,
  crearVacuna,
} from "@/lib/chapitas/clinicaOps";
import {
  esServicioVacunacion,
  listarServiciosDeVeterinario,
} from "@/lib/chapitas/clinicas";
import { confirmGuardar } from "@/lib/confirmAction";

const SLOT_MINUTES = 30;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toLocalInputFromDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toLocalInputValue(iso) {
  if (!iso) return "";
  return toLocalInputFromDate(new Date(iso));
}

/** Suma minutos a un valor datetime-local sin cambiar de zona. */
function addMinutesToLocalInput(value, minutes) {
  if (!value) return "";
  const [datePart, timePart = "00:00"] = String(value).split("T");
  const [y, m, day] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  if (![y, m, day, hh, mm].every((n) => Number.isFinite(n))) return "";
  const d = new Date(y, m - 1, day, hh, mm || 0, 0, 0);
  d.setMinutes(d.getMinutes() + minutes);
  return toLocalInputFromDate(d);
}

function combineFechaHora(fechaISO, hora) {
  if (!fechaISO || !hora) return "";
  return `${fechaISO}T${hora}`;
}

export default function CitaForm({
  clinicaId,
  pacientes,
  clientes,
  vets,
  servicios,
  initial,
  defaultDay,
  lockPaciente = false,
  onCancel,
  onSaved,
}) {
  const defaultStart = new Date(defaultDay || new Date());
  if (!initial?.inicio) {
    defaultStart.setHours(10, 0, 0, 0);
  }
  const inicioInicial =
    toLocalInputValue(initial?.inicio) || toLocalInputFromDate(defaultStart);
  const finInicial =
    toLocalInputValue(initial?.fin) ||
    (initial?.inicio || !initial?.id
      ? addMinutesToLocalInput(inicioInicial, SLOT_MINUTES)
      : "");
  const [form, setForm] = useState({
    paciente_id: initial?.paciente_id || "",
    cliente_id: initial?.cliente_id || "",
    veterinario_id: initial?.veterinario_id || "",
    servicio_id: initial?.servicio_id || "",
    inicio: inicioInicial,
    fin: finInicial,
    estado: initial?.estado || "confirmada",
    motivo: initial?.motivo || "",
    notas: initial?.notas || "",
    vacuna_nombre: "",
    vacuna_lote: "",
    vacuna_proxima_fecha: "",
    programar_recordatorio: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [slotsLibres, setSlotsLibres] = useState([]);
  const [slotsDia, setSlotsDia] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [disponibilidadMsg, setDisponibilidadMsg] = useState("");
  const [serviciosVet, setServiciosVet] = useState([]);

  const serviciosDisponibles =
    form.veterinario_id && serviciosVet.length > 0 ? serviciosVet : servicios;
  const servicioSeleccionado = serviciosDisponibles.find((s) => s.id === form.servicio_id);
  const esVacunacion = esServicioVacunacion(servicioSeleccionado);

  useEffect(() => {
    let cancelled = false;
    async function loadServiciosVet() {
      if (!form.veterinario_id) {
        setServiciosVet([]);
        return;
      }
      try {
        const rows = await listarServiciosDeVeterinario(form.veterinario_id);
        if (cancelled) return;
        setServiciosVet(rows);
        if (rows.length && form.servicio_id && !rows.some((s) => s.id === form.servicio_id)) {
          setForm((f) => ({ ...f, servicio_id: "" }));
        }
      } catch {
        if (!cancelled) setServiciosVet([]);
      }
    }
    loadServiciosVet();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.veterinario_id]);
  const { fechaISO: fechaSeleccionada, hora: horaSeleccionada } = fechaHoraLocalDesdeValor(
    form.inicio,
  );

  useEffect(() => {
    let cancelled = false;
    async function loadSlots() {
      if (form.estado === "lista_espera" || !form.veterinario_id || !fechaSeleccionada) {
        setSlotsLibres([]);
        setSlotsDia([]);
        setDisponibilidadMsg("");
        return;
      }
      setLoadingSlots(true);
      setDisponibilidadMsg("");
      try {
        const data = await listarDisponibilidadVeterinario({
          clinicaId,
          veterinarioId: form.veterinario_id,
          fechaISO: fechaSeleccionada,
          citaIdExcluir: initial?.id,
        });
        if (cancelled) return;
        setSlotsDia(data.slotsDia);
        setSlotsLibres(data.slotsLibres);
        if (!data.horarios.length) {
          setDisponibilidadMsg(
            "Este veterinario no tiene horarios cargados. Configurá su agenda antes de citar.",
          );
        } else if (!data.slotsDia.length) {
          setDisponibilidadMsg("El veterinario no atiende este día.");
        } else if (!data.slotsLibres.length) {
          setDisponibilidadMsg("No quedan turnos libres este día para el veterinario.");
        } else if (horaSeleccionada && !data.slotsDia.includes(horaSeleccionada)) {
          setDisponibilidadMsg(
            `La hora elegida está fuera de agenda. Turnos del día: ${data.slotsDia.join(", ")}.`,
          );
        } else if (horaSeleccionada && !data.slotsLibres.includes(horaSeleccionada)) {
          setDisponibilidadMsg("Esa hora ya está ocupada. Elegí otro turno libre.");
        } else {
          setDisponibilidadMsg("");
        }
      } catch (err) {
        if (!cancelled) {
          setSlotsLibres([]);
          setSlotsDia([]);
          setDisponibilidadMsg(
            err instanceof Error ? err.message : "No se pudo verificar disponibilidad.",
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
  }, [
    clinicaId,
    form.veterinario_id,
    form.estado,
    fechaSeleccionada,
    horaSeleccionada,
    initial?.id,
  ]);

  function onPacienteChange(pacienteId) {
    const paciente = pacientes.find((p) => p.id === pacienteId);
    setForm((f) => ({
      ...f,
      paciente_id: pacienteId,
      cliente_id: paciente?.cliente_id || f.cliente_id,
    }));
  }

  function onInicioChange(value) {
    setForm((f) => ({
      ...f,
      inicio: value,
      fin: value ? addMinutesToLocalInput(value, SLOT_MINUTES) : "",
    }));
  }

  function onSlotClick(hora) {
    if (!fechaSeleccionada) return;
    const inicio = combineFechaHora(fechaSeleccionada, hora);
    setForm((f) => ({
      ...f,
      inicio,
      fin: addMinutesToLocalInput(inicio, SLOT_MINUTES),
    }));
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.estado !== "lista_espera" && !form.veterinario_id) {
      setError("Elegí un veterinario para validar su disponibilidad.");
      return;
    }
    if (esVacunacion && !form.vacuna_nombre.trim()) {
      setError("Indicá el nombre de la vacuna aplicada o a aplicar.");
      return;
    }
    if (!(await confirmGuardar(initial?.id ? "los cambios de la cita" : "la nueva cita"))) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (form.estado !== "lista_espera") {
        await validarDisponibilidadVeterinario({
          clinicaId,
          veterinarioId: form.veterinario_id,
          inicio: form.inicio,
          citaIdExcluir: initial?.id,
          requerirVeterinario: true,
        });
      }

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
        motivo: form.motivo || (esVacunacion ? `Vacunación: ${form.vacuna_nombre.trim()}` : ""),
        notas: form.notas,
      };
      if (initial?.id) {
        await actualizarCita(initial.id, payload);
      } else {
        await crearCita(clinicaId, payload);
      }

      if (esVacunacion && form.paciente_id) {
        const fechaVacuna = form.inicio
          ? String(form.inicio).slice(0, 10)
          : new Date().toISOString().slice(0, 10);
        await crearVacuna(clinicaId, {
          paciente_id: form.paciente_id,
          nombre: form.vacuna_nombre.trim(),
          fecha: fechaVacuna,
          proxima_fecha: form.vacuna_proxima_fecha || null,
          lote: form.vacuna_lote,
          veterinario_id: form.veterinario_id || null,
          notas: form.notas || null,
        });

        if (form.programar_recordatorio && form.vacuna_proxima_fecha) {
          await crearRecordatorio(clinicaId, {
            paciente_id: form.paciente_id,
            cliente_id: form.cliente_id || null,
            tipo: "vacuna",
            titulo: `Refuerzo: ${form.vacuna_nombre.trim()}`,
            detalle: form.vacuna_lote
              ? `Lote ${form.vacuna_lote}`
              : "Recordatorio de vacunación",
            fecha_proxima: form.vacuna_proxima_fecha,
          });
        }
      }

      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la cita.");
    } finally {
      setSaving(false);
    }
  }

  const pacienteFijo = lockPaciente
    ? pacientes.find((p) => p.id === form.paciente_id)
    : null;

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
          {lockPaciente ? (
            <input
              id="cita-pac"
              disabled
              className={`${fieldClass} bg-stone-50 text-stone-600`}
              value={
                pacienteFijo
                  ? `${pacienteFijo.nombre}${
                      pacienteFijo.clinica_clientes?.nombre_completo
                        ? ` (${pacienteFijo.clinica_clientes.nombre_completo})`
                        : ""
                    }`
                  : "Paciente"
              }
            />
          ) : (
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
          )}
        </Field>
        <Field label="Cliente" id="cita-cli">
          <select
            id="cita-cli"
            className={fieldClass}
            value={form.cliente_id}
            onChange={(e) => setForm((f) => ({ ...f, cliente_id: e.target.value }))}
            disabled={lockPaciente}
          >
            <option value="">Seleccionar…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre_completo}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Veterinario *" id="cita-vet">
          <select
            id="cita-vet"
            className={fieldClass}
            value={form.veterinario_id}
            required={form.estado !== "lista_espera"}
            onChange={(e) => setForm((f) => ({ ...f, veterinario_id: e.target.value }))}
          >
            <option value="">Seleccionar…</option>
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
            {serviciosDisponibles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
          {form.veterinario_id && serviciosVet.length === 0 ? (
            <p className="mt-1 text-xs text-amber-700">
              Este vet no tiene servicios asignados: se muestran todos los de la clínica. Cargalos
              en su perfil.
            </p>
          ) : null}
        </Field>
        <Field label="Inicio" id="cita-ini">
          <input
            id="cita-ini"
            type="datetime-local"
            className={fieldClass}
            value={form.inicio}
            onChange={(e) => onInicioChange(e.target.value)}
            disabled={form.estado === "lista_espera"}
            required={form.estado !== "lista_espera"}
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

      {form.estado !== "lista_espera" && form.veterinario_id ? (
        <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3">
          <p className="text-sm font-medium text-aguara-ink">
            Turnos libres del veterinario
            {fechaSeleccionada ? ` · ${fechaSeleccionada}` : ""}
          </p>
          {loadingSlots ? (
            <p className="mt-2 text-xs text-stone-500">Verificando agenda…</p>
          ) : disponibilidadMsg ? (
            <p className="mt-2 text-sm text-amber-800">{disponibilidadMsg}</p>
          ) : null}
          {slotsLibres.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {slotsLibres.map((hora) => (
                <button
                  key={hora}
                  type="button"
                  onClick={() => onSlotClick(hora)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    horaSeleccionada === hora
                      ? "border-aguara-orange bg-aguara-orange text-white"
                      : "border-emerald-300 bg-emerald-100 text-emerald-950 hover:bg-emerald-200"
                  }`}
                >
                  {hora}
                </button>
              ))}
            </div>
          ) : null}
          {slotsDia.length > 0 && slotsLibres.length === 0 && !disponibilidadMsg ? (
            <p className="mt-2 text-xs text-stone-500">Sin turnos libres.</p>
          ) : null}
        </div>
      ) : null}

      {esVacunacion ? (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <p className="text-sm font-semibold text-emerald-950">Datos de vacunación</p>
          <p className="text-xs text-emerald-900/80">
            Se agregará al historial de vacunas del paciente. Si cargás la próxima fecha, podés
            programar el recordatorio de refuerzo.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vacuna *" id="cita-vac-nom">
              <input
                id="cita-vac-nom"
                required
                className={fieldClass}
                placeholder="Ej. Antirrábica, Triple felina…"
                value={form.vacuna_nombre}
                onChange={(e) => setForm((f) => ({ ...f, vacuna_nombre: e.target.value }))}
              />
            </Field>
            <Field label="Lote" id="cita-vac-lote">
              <input
                id="cita-vac-lote"
                className={fieldClass}
                value={form.vacuna_lote}
                onChange={(e) => setForm((f) => ({ ...f, vacuna_lote: e.target.value }))}
              />
            </Field>
            <Field label="Próxima dosis / refuerzo" id="cita-vac-prox">
              <input
                id="cita-vac-prox"
                type="date"
                className={fieldClass}
                value={form.vacuna_proxima_fecha}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vacuna_proxima_fecha: e.target.value }))
                }
              />
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm text-emerald-950">
              <input
                type="checkbox"
                checked={form.programar_recordatorio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, programar_recordatorio: e.target.checked }))
                }
                disabled={!form.vacuna_proxima_fecha}
              />
              Programar recordatorio al tutor
            </label>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={primaryBtnClass}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" className={secondaryBtnClass} onClick={onCancel}>
          Cancelar
        </button>
      </div>
      {initial?.creado_en ? (
        <p className="text-xs text-stone-400">
          Última edición: {formatDateTime(initial.creado_en)}
        </p>
      ) : null}
    </form>
  );
}
