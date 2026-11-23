"use client";

import { useEffect, useMemo, useState } from "react";

import {
  cardClass,
  Field,
  fieldClass,
  formatDateTime,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/clinica/ui";
import RegistrarClienteMascotaPanel from "@/components/clinica/RegistrarClienteMascotaPanel";
import MascotaRegistroFields, {
  emptyPetFormConCabecera,
  validateMascotaRegistroForm,
} from "@/components/mascotas/MascotaRegistroFields";
import {
  listarDisponibilidadVeterinario,
  validarDisponibilidadVeterinario,
} from "@/lib/chapitas/agendaDisponibilidad";
import { fechaHoraLocalDesdeValor } from "@/lib/chapitas/agendaSlots";
import {
  CITA_ESTADOS,
  actualizarCita,
  crearCita,
  crearPaciente,
  crearRecordatorio,
  crearVacuna,
} from "@/lib/chapitas/clinicaOps";
import {
  esServicioVacunacion,
  listarServiciosDeVeterinario,
} from "@/lib/chapitas/clinicas";
import { readClinicSession } from "@/lib/chapitas/clinicSession";
import { confirmGuardar } from "@/lib/confirmAction";

function etiquetaMascota(p) {
  const especie = p?.especie ? ` · ${p.especie}` : "";
  const raza = p?.raza ? ` · ${p.raza}` : "";
  return `${p.nombre || "Mascota"}${especie}${raza}`;
}

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
  onPacientesChange,
  onClientesChange,
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
  const pacienteInicial = (pacientes || []).find((p) => p.id === initial?.paciente_id);
  const [form, setForm] = useState({
    paciente_id: initial?.paciente_id || "",
    cliente_id: initial?.cliente_id || pacienteInicial?.cliente_id || "",
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
  const [pacientesLocal, setPacientesLocal] = useState(pacientes || []);
  const [clientesLocal, setClientesLocal] = useState(clientes || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [slotsLibres, setSlotsLibres] = useState([]);
  const [slotsDia, setSlotsDia] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [disponibilidadMsg, setDisponibilidadMsg] = useState("");
  const [serviciosVet, setServiciosVet] = useState([]);
  const [showNuevaMascota, setShowNuevaMascota] = useState(false);
  const [petForm, setPetForm] = useState(() => emptyPetFormConCabecera(clinicaId));
  const [savingPet, setSavingPet] = useState(false);
  const clinicasCabecera = useMemo(() => {
    const session = readClinicSession();
    if (session?.id === clinicaId) {
      return [{ id: session.id, nombre: session.nombre, ciudad: session.ciudad }];
    }
    return clinicaId ? [{ id: clinicaId, nombre: "Esta clínica" }] : [];
  }, [clinicaId]);

  useEffect(() => {
    setPacientesLocal(pacientes || []);
  }, [pacientes]);

  useEffect(() => {
    setClientesLocal(clientes || []);
  }, [clientes]);

  const clientesOpts = useMemo(() => {
    return [...(clientesLocal || [])].sort((a, b) =>
      String(a.nombre_completo || "").localeCompare(String(b.nombre_completo || ""), "es"),
    );
  }, [clientesLocal]);

  const mascotasDelCliente = useMemo(() => {
    if (!form.cliente_id) return [];
    return (pacientesLocal || []).filter(
      (p) => (p.cliente_id || p.clinica_clientes?.id) === form.cliente_id,
    );
  }, [pacientesLocal, form.cliente_id]);

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

  function onClienteChange(clienteId) {
    setShowNuevaMascota(false);
    setShowNuevoCliente(false);
    setForm((f) => {
      const sigueValido = (pacientesLocal || []).some(
        (p) =>
          p.id === f.paciente_id &&
          (p.cliente_id || p.clinica_clientes?.id) === clienteId,
      );
      return {
        ...f,
        cliente_id: clienteId,
        paciente_id: sigueValido ? f.paciente_id : "",
      };
    });
  }

  function handleClienteMascotaCreado({ cliente, paciente }) {
    const nextClientes = [cliente, ...clientesLocal.filter((c) => c.id !== cliente.id)];
    setClientesLocal(nextClientes);
    onClientesChange?.(nextClientes);
    const nextPacientes = [paciente, ...pacientesLocal.filter((p) => p.id !== paciente.id)];
    setPacientesLocal(nextPacientes);
    onPacientesChange?.(nextPacientes);
    setForm((f) => ({
      ...f,
      cliente_id: cliente.id,
      paciente_id: paciente.id,
    }));
    setShowNuevoCliente(false);
    setShowNuevaMascota(false);
    setError("");
  }

  function onPacienteChange(pacienteId) {
    const paciente = pacientesLocal.find((p) => p.id === pacienteId);
    setForm((f) => ({
      ...f,
      paciente_id: pacienteId,
      cliente_id: paciente?.cliente_id || paciente?.clinica_clientes?.id || f.cliente_id,
    }));
  }

  async function handleCrearMascota(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!form.cliente_id) {
      setError("Elegí un cliente antes de crear la mascota.");
      return;
    }
    const invalid = validateMascotaRegistroForm(petForm);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!(await confirmGuardar(`la nueva mascota “${petForm.nombre_mascota.trim()}”`))) return;
    setSavingPet(true);
    setError("");
    try {
      const creado = await crearPaciente(clinicaId, {
        cliente_id: form.cliente_id,
        nombre: petForm.nombre_mascota,
        especie: petForm.especie,
        raza: petForm.raza,
        sexo: petForm.sexo,
        castrado: petForm.castrado,
        temperamento: petForm.temperamento,
        fecha_nacimiento: petForm.fecha_nacimiento,
        peso: petForm.peso,
        nro_chip: petForm.nro_chip,
        enfermedad: petForm.enfermedad,
        medicacion: petForm.medicacion,
        datos_adicionales: petForm.datos_adicionales,
        clinica_cabecera_id: petForm.clinica_cabecera_id || clinicaId,
        clinica_ref_nombre: petForm.clinica_ref_nombre,
        clinica_ref_direccion: petForm.clinica_ref_direccion,
        clinica_ref_telefono: petForm.clinica_ref_telefono,
      });
      const nextList = [creado, ...pacientesLocal.filter((p) => p.id !== creado.id)];
      setPacientesLocal(nextList);
      onPacientesChange?.(nextList);
      setForm((f) => ({ ...f, paciente_id: creado.id }));
      setShowNuevaMascota(false);
      setPetForm(emptyPetFormConCabecera(clinicaId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la mascota.");
    } finally {
      setSavingPet(false);
    }
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
    if (showNuevoCliente) {
      setError("Guardá el cliente nuevo (o cancelá) antes de continuar con la cita.");
      return;
    }
    if (showNuevaMascota) {
      setError("Guardá la nueva mascota para continuar con la cita.");
      return;
    }
    if (!form.cliente_id) {
      setError("Elegí el cliente.");
      return;
    }
    if (!form.paciente_id && form.estado !== "lista_espera") {
      setError("Elegí una mascota del cliente (o creá una nueva).");
      return;
    }
    if (form.estado !== "lista_espera" && !form.veterinario_id) {
      setError("Elegí un veterinario para validar su disponibilidad.");
      return;
    }
    if (
      form.estado !== "lista_espera" &&
      disponibilidadMsg &&
      (!horaSeleccionada || !slotsLibres.includes(horaSeleccionada))
    ) {
      setError(disponibilidadMsg);
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
    ? pacientesLocal.find((p) => p.id === form.paciente_id)
    : null;
  const clienteFijo = lockPaciente
    ? clientesOpts.find((c) => c.id === form.cliente_id) ||
      pacienteFijo?.clinica_clientes ||
      null
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
        <div className="space-y-2">
          <Field label="Cliente" id="cita-cli">
            {lockPaciente ? (
              <input
                id="cita-cli"
                disabled
                className={`${fieldClass} bg-stone-50 text-stone-600`}
                value={clienteFijo?.nombre_completo || "Cliente"}
              />
            ) : (
              <select
                id="cita-cli"
                required={!showNuevoCliente}
                className={fieldClass}
                value={form.cliente_id}
                disabled={showNuevoCliente}
                onChange={(e) => onClienteChange(e.target.value)}
              >
                <option value="">Seleccionar cliente…</option>
                {clientesOpts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre_completo}
                    {c.telefono ? ` · ${c.telefono}` : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {!lockPaciente && !initial?.id ? (
            <button
              type="button"
              className="text-sm font-medium text-aguara-orange hover:underline"
              onClick={() => {
                setError("");
                setShowNuevaMascota(false);
                setShowNuevoCliente((v) => !v);
              }}
            >
              {showNuevoCliente ? "Cancelar registro" : "+ Registrar cliente"}
            </button>
          ) : null}
        </div>
        <div className="space-y-2">
          <Field label="Mascota" id="cita-pac">
            {lockPaciente ? (
              <input
                id="cita-pac"
                disabled
                className={`${fieldClass} bg-stone-50 text-stone-600`}
                value={pacienteFijo ? etiquetaMascota(pacienteFijo) : "Mascota"}
              />
            ) : (
              <select
                id="cita-pac"
                required={!showNuevaMascota && !showNuevoCliente && form.estado !== "lista_espera"}
                className={fieldClass}
                value={form.paciente_id}
                disabled={!form.cliente_id || showNuevaMascota || showNuevoCliente}
                onChange={(e) => onPacienteChange(e.target.value)}
              >
                <option value="">
                  {!form.cliente_id
                    ? "Primero elegí el cliente…"
                    : mascotasDelCliente.length
                      ? "Seleccionar mascota…"
                      : "Este cliente no tiene mascotas cargadas"}
                </option>
                {mascotasDelCliente.map((p) => (
                  <option key={p.id} value={p.id}>
                    {etiquetaMascota(p)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {!lockPaciente && !initial?.id ? (
            <button
              type="button"
              className="text-sm font-medium text-aguara-orange hover:underline disabled:opacity-50"
              disabled={!form.cliente_id || showNuevoCliente}
              onClick={() => {
                setError("");
                setShowNuevoCliente(false);
                setShowNuevaMascota((v) => !v);
              }}
            >
              {showNuevaMascota ? "Cancelar nueva mascota" : "+ Crear nueva mascota"}
            </button>
          ) : null}
        </div>

        {showNuevoCliente ? (
          <RegistrarClienteMascotaPanel
            clinicaId={clinicaId}
            fotoInputId="cita-nuevo-cliente"
            onCancel={() => setShowNuevoCliente(false)}
            onCreated={handleClienteMascotaCreado}
          />
        ) : null}

        {showNuevaMascota ? (
          <div className="sm:col-span-2 space-y-3 rounded-xl border border-aguara-orange/25 bg-aguara-cream/30 p-3">
            <p className="text-sm font-semibold text-aguara-ink">
              Nueva mascota del cliente seleccionado
            </p>
            <MascotaRegistroFields
              form={petForm}
              onChange={(name, value) => setPetForm((f) => ({ ...f, [name]: value }))}
              fieldClass={fieldClass}
              fotoInputId="cita-nueva-mascota"
              showTitle={false}
              clinicas={clinicasCabecera}
            />
            <button
              type="button"
              disabled={savingPet || !form.cliente_id}
              className={secondaryBtnClass}
              onClick={handleCrearMascota}
            >
              {savingPet ? "Creando mascota…" : "Guardar mascota y continuar"}
            </button>
          </div>
        ) : null}

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
            {CITA_ESTADOS.filter((e) =>
              ["pendiente", "confirmada", "lista_espera", "finalizada", "no_asistio", "cancelada"].includes(
                e.id,
              ),
            ).map((e) => (
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
      {showNuevoCliente ? (
        <p className="text-sm text-amber-800">
          Guardá el cliente y la mascota para poder continuar con la cita.
        </p>
      ) : null}
      {showNuevaMascota ? (
        <p className="text-sm text-amber-800">
          Guardá la nueva mascota para poder continuar con la cita.
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={
            saving ||
            showNuevaMascota ||
            showNuevoCliente ||
            (!lockPaciente && form.estado !== "lista_espera" && !form.paciente_id)
          }
          className={primaryBtnClass}
        >
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
