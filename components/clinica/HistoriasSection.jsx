"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  cardClass,
  Field,
  fieldClass,
  formatDateTime,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/clinica/ui";
import RegistrarClienteMascotaPanel from "@/components/clinica/RegistrarClienteMascotaPanel";
import useClinicaCabeceraOptions from "@/components/clinica/useClinicaCabeceraOptions";
import MascotaRegistroFields, {
  emptyPetFormConCabecera,
  validateMascotaRegistroForm,
} from "@/components/mascotas/MascotaRegistroFields";
import MedicacionExtrasFields, {
  normalizeHorarios,
} from "@/components/mascotas/MedicacionExtrasFields";
import RecetaDocumento, { exportRecetaJpeg } from "@/components/clinica/RecetaDocumento";
import {
  emptyHcMedItem,
  formatHcMedicacionDisplay,
  formatHcMedicacionLines,
  parseHcMedicacion,
  serializeHcMedicacion,
} from "@/lib/chapitas/hcMedicacion";
import {
  actualizarConsulta,
  cerrarConsulta,
  consultaPendienteCompletar,
  crearArchivosDesdeFiles,
  crearConsulta,
  crearDesparasitacion,
  crearPaciente,
  crearVacuna,
  listarArchivos,
  listarClientes,
  listarConsultas,
  listarPacientes,
  listarVeterinarios,
  obtenerCliente,
  obtenerConsulta,
  obtenerPaciente,
} from "@/lib/chapitas/clinicaOps";
import { obtenerClinica } from "@/lib/chapitas/clinicas";
import { crearTratamiento } from "@/lib/chapitas/mascotaPerfil";
import { proximaFechaDesdeAplicacion, vacunasParaEspecie } from "@/lib/chapitas/vacunas";
import { confirmGuardar } from "@/lib/confirmAction";
import { formatDate } from "@/lib/dateFormat";

export default function HistoriasSection({ clinicaId }) {
  const [consultas, setConsultas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vets, setVets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const [c, p, cl, v] = await Promise.all([
        listarConsultas(clinicaId),
        listarPacientes(clinicaId),
        listarClientes(clinicaId),
        listarVeterinarios(clinicaId),
      ]);
      setConsultas(c);
      setPacientes(p);
      setClientes(cl);
      setVets(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las historias.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId]);

  if (selectedId) {
    return (
      <DetalleConsulta
        clinicaId={clinicaId}
        consultaId={selectedId}
        vets={vets}
        onBack={() => setSelectedId(null)}
        onChanged={async () => {
          await reload();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-aguara-ink">Historias clínicas</h2>
          <p className="text-sm text-stone-500">
            Consultas, diagnósticos, vacunas, desparasitaciones y archivos
          </p>
        </div>
        <button type="button" className={primaryBtnClass} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cerrar" : "Nueva consulta"}
        </button>
      </div>

      {showForm ? (
        <ConsultaForm
          clinicaId={clinicaId}
          pacientes={pacientes}
          clientes={clientes}
          vets={vets}
          onPacientesChange={setPacientes}
          onClientesChange={setClientes}
          onSaved={async () => {
            setShowForm(false);
            await reload();
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className={cardClass}>
        {loading ? (
          <p className="text-sm text-stone-500">Cargando…</p>
        ) : consultas.length === 0 ? (
          <p className="text-sm text-stone-500">Todavía no hay consultas.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {consultas.map((c) => {
              const porCompletar = consultaPendienteCompletar(c);
              const propia = !c.clinica_id || c.clinica_id === clinicaId;
              return (
              <li key={c.id}>
                <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-aguara-ink">
                      {c.clinica_pacientes?.nombre || "Paciente"} · {formatDateTime(c.fecha)}
                      {porCompletar ? (
                        <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                          Completar
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-stone-500">
                      {c.motivo || "Consulta"} · {c.clinica_veterinarios?.nombre || "Sin vet"} ·{" "}
                      {c.cerrada ? "Cerrada" : porCompletar ? "Por completar" : "Abierta"}
                      {!propia
                        ? ` · compartida (${c.clinicas?.nombre || "otra clínica"})`
                        : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      Última modificación:{" "}
                      {formatDateTime(c.actualizado_en || c.cerrado_en || c.creado_en || c.fecha)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={porCompletar && propia ? primaryBtnClass : secondaryBtnClass}
                    onClick={() => setSelectedId(c.id)}
                  >
                    {porCompletar && propia ? "Completar" : "Ver"}
                  </button>
                </div>
              </li>
            );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function etiquetaMascota(p) {
  const especie = p?.especie ? ` · ${p.especie}` : "";
  const raza = p?.raza ? ` · ${p.raza}` : "";
  return `${p.nombre || "Mascota"}${especie}${raza}`;
}

const EMPTY_LIST = [];

export function ConsultaForm({
  clinicaId,
  pacientes = EMPTY_LIST,
  clientes = EMPTY_LIST,
  vets,
  onSaved,
  onCancel,
  onPacientesChange,
  onClientesChange,
  initial,
  lockPaciente = false,
}) {
  const pacienteInicial = pacientes.find((p) => p.id === initial?.paciente_id);
  const [clienteId, setClienteId] = useState(
    initial?.cliente_id || pacienteInicial?.cliente_id || "",
  );
  const [pacientesLocal, setPacientesLocal] = useState(pacientes);
  const [clientesLocal, setClientesLocal] = useState(clientes);
  const [form, setForm] = useState({
    paciente_id: initial?.paciente_id || "",
    veterinario_id: initial?.veterinario_id || "",
    motivo: initial?.motivo || "",
    anamnesis: initial?.anamnesis || "",
    examen_fisico: initial?.examen_fisico || "",
    diagnostico: initial?.diagnostico || "",
    tratamiento: initial?.tratamiento || "",
    peso: initial?.peso ?? "",
    temperatura: initial?.temperatura ?? "",
    observaciones: initial?.observaciones || "",
    incluir_diagnostico_receta: Boolean(initial?.incluir_diagnostico_receta),
  });
  const [medItems, setMedItems] = useState(() => parseHcMedicacion(initial?.medicacion));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [showNuevaMascota, setShowNuevaMascota] = useState(false);
  const [petForm, setPetForm] = useState(() => emptyPetFormConCabecera(clinicaId));
  const [savingPet, setSavingPet] = useState(false);
  const clinicasCabecera = useClinicaCabeceraOptions(clinicaId);

  useEffect(() => {
    setPetForm((f) =>
      f.clinica_cabecera_id === clinicaId ? f : { ...f, clinica_cabecera_id: clinicaId || "" },
    );
  }, [clinicaId]);

  useEffect(() => {
    setPacientesLocal(pacientes);
  }, [pacientes]);

  useEffect(() => {
    setClientesLocal(clientes);
  }, [clientes]);

  const clientesOpts = useMemo(() => {
    if (clientesLocal?.length) {
      return [...clientesLocal].sort((a, b) =>
        String(a.nombre_completo || "").localeCompare(String(b.nombre_completo || ""), "es"),
      );
    }
    const map = new Map();
    for (const p of pacientesLocal || []) {
      const id = p.cliente_id || p.clinica_clientes?.id;
      if (!id || map.has(id)) continue;
      map.set(id, {
        id,
        nombre_completo:
          p.clinica_clientes?.nombre_completo || p.cliente_nombre || "Cliente sin nombre",
      });
    }
    return [...map.values()].sort((a, b) =>
      String(a.nombre_completo).localeCompare(String(b.nombre_completo), "es"),
    );
  }, [clientesLocal, pacientesLocal]);

  const mascotasDelCliente = useMemo(() => {
    if (!clienteId) return [];
    return (pacientesLocal || []).filter(
      (p) => (p.cliente_id || p.clinica_clientes?.id) === clienteId,
    );
  }, [pacientesLocal, clienteId]);

  function handleClienteMascotaCreado({ cliente, paciente }) {
    const nextClientes = [cliente, ...clientesLocal.filter((c) => c.id !== cliente.id)];
    setClientesLocal(nextClientes);
    onClientesChange?.(nextClientes);
    const nextPacientes = [paciente, ...pacientesLocal.filter((p) => p.id !== paciente.id)];
    setPacientesLocal(nextPacientes);
    onPacientesChange?.(nextPacientes);
    setClienteId(cliente.id);
    setForm((f) => ({ ...f, paciente_id: paciente.id }));
    setShowNuevoCliente(false);
    setShowNuevaMascota(false);
    setError("");
  }

  async function handleCrearMascota(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!clienteId) {
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
        cliente_id: clienteId,
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

  async function handleSubmit(event) {
    event.preventDefault();
    if (showNuevoCliente) {
      setError("Guardá el cliente nuevo (o cancelá) antes de continuar.");
      return;
    }
    if (showNuevaMascota) {
      setError("Guardá la nueva mascota (o cancelá) antes de continuar.");
      return;
    }
    if (!clienteId) {
      setError("Elegí el cliente.");
      return;
    }
    if (!form.paciente_id) {
      setError("Elegí una mascota del cliente (o creá una nueva).");
      return;
    }
    if (
      !(await confirmGuardar(
        initial?.id ? "los cambios de la historia clínica" : "la nueva historia clínica",
      ))
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const paciente = pacientesLocal.find((p) => p.id === form.paciente_id);
      const medicacionTexto = serializeHcMedicacion(medItems);
      const payload = {
        ...form,
        medicacion: medicacionTexto,
        incluir_diagnostico_receta: Boolean(form.incluir_diagnostico_receta),
        cliente_id: paciente?.cliente_id || clienteId || null,
      };
      if (initial?.id) {
        await actualizarConsulta(
          initial.id,
          {
            motivo: payload.motivo?.trim() || null,
            anamnesis: payload.anamnesis?.trim() || null,
            examen_fisico: payload.examen_fisico?.trim() || null,
            diagnostico: payload.diagnostico?.trim() || null,
            tratamiento: payload.tratamiento?.trim() || null,
            medicacion: payload.medicacion?.trim() || null,
            peso: payload.peso === "" || payload.peso == null ? null : Number(payload.peso),
            temperatura:
              payload.temperatura === "" || payload.temperatura == null
                ? null
                : Number(payload.temperatura),
            observaciones: payload.observaciones?.trim() || null,
            veterinario_id: payload.veterinario_id || null,
            incluir_diagnostico_receta: Boolean(payload.incluir_diagnostico_receta),
          },
          { clinicaId },
        );
      } else {
        await crearConsulta(clinicaId, payload);
        // También deja cada medicamento en la ficha (tratamiento activo).
        const itemsOk = parseHcMedicacion(medicacionTexto).filter((i) => i.medicamento);
        if (itemsOk.length && form.paciente_id) {
          const hoy = new Date().toISOString().slice(0, 10);
          for (const item of itemsOk) {
            try {
              const detalleParts = [];
              if (item.dosis) detalleParts.push(`Dosis: ${item.dosis}`);
              if (item.tiempo) detalleParts.push(`Tiempo: ${item.tiempo}`);
              if (item.indicaciones) detalleParts.push(`Indicaciones: ${item.indicaciones}`);
              await crearTratamiento(clinicaId, {
                paciente_id: form.paciente_id,
                titulo: item.medicamento,
                detalle: detalleParts.length ? detalleParts.join(" · ") : null,
                fecha_inicio: hoy,
                fecha_fin: null,
                de_por_vida: false,
                horarios: [],
              });
            } catch {
              // La HC ya se guardó; la ficha puede completarse después.
            }
          }
        }
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-3`}>
      <h3 className="font-semibold text-aguara-ink">
        {initial?.id
          ? consultaPendienteCompletar(initial)
            ? "Completar historia clínica"
            : "Editar historia clínica"
          : "Nueva consulta / evolución"}
      </h3>
      {initial?.id ? (
        <p className="text-sm text-stone-500">
          Última modificación:{" "}
          {formatDateTime(
            initial.actualizado_en || initial.cerrado_en || initial.creado_en || initial.fecha,
          )}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Field label="Cliente" id="hc-cliente">
            <select
              id="hc-cliente"
              required={!showNuevoCliente}
              disabled={Boolean(initial?.id) || lockPaciente || showNuevoCliente}
              className={fieldClass}
              value={clienteId}
              onChange={(e) => {
                const next = e.target.value;
                setClienteId(next);
                setShowNuevaMascota(false);
                setShowNuevoCliente(false);
                setForm((f) => {
                  const sigueValido = (pacientesLocal || []).some(
                    (p) =>
                      p.id === f.paciente_id &&
                      (p.cliente_id || p.clinica_clientes?.id) === next,
                  );
                  return { ...f, paciente_id: sigueValido ? f.paciente_id : "" };
                });
              }}
            >
              <option value="">Seleccionar cliente…</option>
              {clientesOpts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_completo}
                  {c.telefono ? ` · ${c.telefono}` : ""}
                </option>
              ))}
            </select>
          </Field>
          {!initial?.id && !lockPaciente ? (
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
          <Field label="Mascota" id="hc-pac">
            <select
              id="hc-pac"
              required={!showNuevaMascota && !showNuevoCliente}
              disabled={
                Boolean(initial?.id) ||
                lockPaciente ||
                !clienteId ||
                showNuevaMascota ||
                showNuevoCliente
              }
              className={fieldClass}
              value={form.paciente_id}
              onChange={(e) => setForm((f) => ({ ...f, paciente_id: e.target.value }))}
            >
              <option value="">
                {!clienteId
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
          </Field>
          {!initial?.id && !lockPaciente ? (
            <button
              type="button"
              className="text-sm font-medium text-aguara-orange hover:underline disabled:opacity-50"
              disabled={!clienteId || showNuevoCliente}
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
        <Field label="Veterinario" id="hc-vet">
          <select
            id="hc-vet"
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

        {showNuevoCliente ? (
          <RegistrarClienteMascotaPanel
            clinicaId={clinicaId}
            fotoInputId="hc-nuevo-cliente"
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
              fotoInputId="hc-nueva-mascota"
              showTitle={false}
              clinicas={clinicasCabecera}
            />
            <button
              type="button"
              disabled={savingPet || !clienteId}
              className={secondaryBtnClass}
              onClick={handleCrearMascota}
            >
              {savingPet ? "Creando mascota…" : "Guardar mascota y continuar"}
            </button>
          </div>
        ) : null}

        <Field label="Motivo" id="hc-mot" className="sm:col-span-2">
          <input
            id="hc-mot"
            className={fieldClass}
            value={form.motivo}
            onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
          />
        </Field>
        <Field label="Anamnesis" id="hc-ana" className="sm:col-span-2">
          <textarea
            id="hc-ana"
            rows={2}
            className={fieldClass}
            value={form.anamnesis}
            onChange={(e) => setForm((f) => ({ ...f, anamnesis: e.target.value }))}
          />
        </Field>
        <Field label="Examen físico" id="hc-ex" className="sm:col-span-2">
          <textarea
            id="hc-ex"
            rows={2}
            className={fieldClass}
            value={form.examen_fisico}
            onChange={(e) => setForm((f) => ({ ...f, examen_fisico: e.target.value }))}
          />
        </Field>
        <Field label="Diagnóstico" id="hc-dx" className="sm:col-span-2">
          <textarea
            id="hc-dx"
            rows={2}
            className={fieldClass}
            value={form.diagnostico}
            onChange={(e) => setForm((f) => ({ ...f, diagnostico: e.target.value }))}
          />
          <label className="mt-2 flex items-start gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(form.incluir_diagnostico_receta)}
              onChange={(e) =>
                setForm((f) => ({ ...f, incluir_diagnostico_receta: e.target.checked }))
              }
            />
            <span>Incluir diagnóstico en la receta</span>
          </label>
        </Field>
        <Field label="Tratamiento" id="hc-tx">
          <textarea
            id="hc-tx"
            rows={2}
            className={fieldClass}
            value={form.tratamiento}
            onChange={(e) => setForm((f) => ({ ...f, tratamiento: e.target.value }))}
          />
        </Field>
        <div className="sm:col-span-2 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-stone-800">Medicación</p>
            <button
              type="button"
              className={secondaryBtnClass}
              onClick={() => setMedItems((rows) => [...rows, emptyHcMedItem()])}
            >
              + Medicamento
            </button>
          </div>
          <div className="space-y-3">
            {medItems.map((item, index) => (
              <div
                key={`med-${index}`}
                className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-stone-500">Medicamento {index + 1}</p>
                  <button
                    type="button"
                    className="text-xs text-stone-500 underline disabled:opacity-40"
                    disabled={medItems.length <= 1}
                    onClick={() =>
                      setMedItems((rows) =>
                        rows.length <= 1 ? [emptyHcMedItem()] : rows.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Quitar
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Medicamento" id={`hc-med-nombre-${index}`}>
                    <input
                      id={`hc-med-nombre-${index}`}
                      className={fieldClass}
                      value={item.medicamento}
                      onChange={(e) =>
                        setMedItems((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, medicamento: e.target.value } : r,
                          ),
                        )
                      }
                      placeholder="Ej. Prednisolona 20 mg"
                    />
                  </Field>
                  <Field label="Dosis" id={`hc-med-dosis-${index}`}>
                    <input
                      id={`hc-med-dosis-${index}`}
                      className={fieldClass}
                      value={item.dosis}
                      onChange={(e) =>
                        setMedItems((rows) =>
                          rows.map((r, i) => (i === index ? { ...r, dosis: e.target.value } : r)),
                        )
                      }
                      placeholder="Ej. 1 comprimido"
                    />
                  </Field>
                  <Field label="Tiempo (duración y frecuencia)" id={`hc-med-tiempo-${index}`}>
                    <input
                      id={`hc-med-tiempo-${index}`}
                      className={fieldClass}
                      value={item.tiempo}
                      onChange={(e) =>
                        setMedItems((rows) =>
                          rows.map((r, i) => (i === index ? { ...r, tiempo: e.target.value } : r)),
                        )
                      }
                      placeholder="Ej. 1 vez al día por 10 días"
                    />
                  </Field>
                  <Field label="Indicaciones" id={`hc-med-ind-${index}`}>
                    <input
                      id={`hc-med-ind-${index}`}
                      className={fieldClass}
                      value={item.indicaciones}
                      onChange={(e) =>
                        setMedItems((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, indicaciones: e.target.value } : r,
                          ),
                        )
                      }
                      placeholder="Ej. con comida"
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Field label="Peso (kg)" id="hc-peso">
          <input
            id="hc-peso"
            type="number"
            step="0.1"
            className={fieldClass}
            value={form.peso}
            onChange={(e) => setForm((f) => ({ ...f, peso: e.target.value }))}
          />
        </Field>
        <Field label="Temperatura (°C)" id="hc-temp">
          <input
            id="hc-temp"
            type="number"
            step="0.1"
            className={fieldClass}
            value={form.temperatura}
            onChange={(e) => setForm((f) => ({ ...f, temperatura: e.target.value }))}
          />
        </Field>
        <Field label="Observaciones" id="hc-obs" className="sm:col-span-2">
          <textarea
            id="hc-obs"
            rows={2}
            className={fieldClass}
            value={form.observaciones}
            onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
          />
        </Field>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {showNuevoCliente ? (
        <p className="text-sm text-amber-800">
          Guardá el cliente y la mascota para poder continuar con la historia clínica.
        </p>
      ) : null}
      {showNuevaMascota ? (
        <p className="text-sm text-amber-800">
          Guardá la nueva mascota para poder continuar con la historia clínica.
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || showNuevaMascota || showNuevoCliente || !form.paciente_id}
          className={primaryBtnClass}
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" className={secondaryBtnClass} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function DetalleConsulta({ clinicaId, consultaId, vets, onBack, onChanged }) {
  const [consulta, setConsulta] = useState(null);
  const [paciente, setPaciente] = useState(null);
  const [editing, setEditing] = useState(false);
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [firmaVetId, setFirmaVetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [fichaMsg, setFichaMsg] = useState("");
  const [fichaErr, setFichaErr] = useState("");
  const [busyFicha, setBusyFicha] = useState(false);
  const [openAdd, setOpenAdd] = useState(null); // vacuna | desparasitacion | archivo | medicacion
  const [vacunaForm, setVacunaForm] = useState({ nombre: "", fecha: "" });
  const [despForm, setDespForm] = useState({ producto: "", fecha: "", proxima_fecha: "" });
  const [archivoForm, setArchivoForm] = useState({ tipo: "estudio", files: [] });
  const [medForm, setMedForm] = useState({
    titulo: "",
    detalle: "",
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_fin: "",
    de_por_vida: false,
    horarios: [""],
  });
  const [archivosConsulta, setArchivosConsulta] = useState([]);
  const [recetaOpen, setRecetaOpen] = useState(false);
  /** "" | "abrir" | "guardar" | "descargar" */
  const [recetaBusy, setRecetaBusy] = useState("");
  const [recetaError, setRecetaError] = useState("");
  const [recetaClinica, setRecetaClinica] = useState(null);
  const [recetaCliente, setRecetaCliente] = useState(null);
  const archivoInputRef = useRef(null);
  const recetaRef = useRef(null);

  function nombreArchivoReceta() {
    const mascotaNombre = (paciente?.nombre || consulta?.clinica_pacientes?.nombre || "paciente")
      .replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/gi, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40);
    return `receta-${mascotaNombre || "paciente"}-${formatDate(new Date()).replace(/\//g, "-")}.jpg`;
  }

  function descargarBlobLocal(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(objectUrl);
  }

  async function loadArchivosConsulta(pacienteId, consultaKey) {
    if (!pacienteId || !consultaKey) {
      setArchivosConsulta([]);
      return;
    }
    try {
      const rows = await listarArchivos(pacienteId);
      setArchivosConsulta((rows || []).filter((a) => a.consulta_id === consultaKey));
    } catch {
      setArchivosConsulta([]);
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [c, pList] = await Promise.all([
        obtenerConsulta(consultaId),
        listarPacientes(clinicaId),
      ]);
      setConsulta(c);
      setPacientes(pList);
      setFirmaVetId(c.veterinario_id || "");

      if (c.paciente_id) {
        const pac = await obtenerPaciente(c.paciente_id);
        setPaciente(pac);
        const catalogo = vacunasParaEspecie(pac.especie);
        setVacunaForm((f) => ({
          nombre: f.nombre && catalogo.includes(f.nombre) ? f.nombre : catalogo[0] || "",
          fecha: f.fecha || new Date().toISOString().slice(0, 10),
        }));
        await loadArchivosConsulta(pac.id, c.id);
      } else {
        setPaciente(null);
        setArchivosConsulta([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la consulta.");
    } finally {
      setLoading(false);
    }
  }

  async function abrirReceta() {
    setRecetaError("");
    if (!formatHcMedicacionLines(consulta.medicacion).length) {
      setRecetaError("La historia no tiene medicación para armar la receta.");
      return;
    }
    setRecetaBusy("abrir");
    try {
      const clienteId = consulta.cliente_id || paciente?.cliente_id || null;
      const [clinicaData, clienteData] = await Promise.all([
        obtenerClinica(clinicaId),
        clienteId ? obtenerCliente(clienteId) : Promise.resolve(null),
      ]);
      setRecetaClinica(clinicaData);
      setRecetaCliente(clienteData);
      setRecetaOpen(true);
    } catch (err) {
      setRecetaError(err instanceof Error ? err.message : "No se pudo preparar la receta.");
    } finally {
      setRecetaBusy("");
    }
  }

  async function descargarRecetaJpeg() {
    setRecetaBusy("descargar");
    setRecetaError("");
    try {
      const file = await exportRecetaJpeg(recetaRef.current, nombreArchivoReceta());
      descargarBlobLocal(file, file.name);
    } catch (err) {
      setRecetaError(err instanceof Error ? err.message : "No se pudo descargar la receta.");
    } finally {
      setRecetaBusy("");
    }
  }

  async function guardarRecetaJpeg() {
    if (!(await confirmGuardar("la receta"))) return;
    setRecetaBusy("guardar");
    setRecetaError("");
    try {
      const file = await exportRecetaJpeg(recetaRef.current, nombreArchivoReceta());
      await crearArchivosDesdeFiles(clinicaId, {
        paciente_id: paciente.id,
        consulta_id: consulta.id,
        tipo: "receta",
        files: [file],
      });
      await loadArchivosConsulta(paciente.id, consulta.id);
      setRecetaOpen(false);
      setFichaMsg("Receta guardada al final de la historia clínica.");
    } catch (err) {
      setRecetaError(err instanceof Error ? err.message : "No se pudo guardar la receta.");
    } finally {
      setRecetaBusy("");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultaId, clinicaId]);

  if (loading) return <p className="text-sm text-stone-500">Cargando consulta…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!consulta) return null;

  if (editing) {
    return (
      <ConsultaForm
        clinicaId={clinicaId}
        pacientes={pacientes}
        vets={vets}
        initial={consulta}
        onCancel={() => setEditing(false)}
        onSaved={async () => {
          setEditing(false);
          await load();
          await onChanged();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <button type="button" className={secondaryBtnClass} onClick={onBack}>
        ← Volver al listado
      </button>

      <div className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-aguara-orange">Vista completa · Historia clínica</p>
            <h2 className="mt-1 text-xl font-semibold text-aguara-ink">
              {consulta.clinica_pacientes?.nombre || paciente?.nombre || "Paciente"}
            </h2>
            <p className="text-sm text-stone-500">
              Fecha de consulta: {formatDateTime(consulta.fecha)}
            </p>
            <p className="text-xs text-stone-400">
              Última modificación:{" "}
              {formatDateTime(
                consulta.actualizado_en || consulta.cerrado_en || consulta.creado_en || consulta.fecha,
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {consulta.clinica_id === clinicaId ? (
              <button
                type="button"
                className={
                  consultaPendienteCompletar(consulta) ? primaryBtnClass : secondaryBtnClass
                }
                onClick={() => setEditing(true)}
              >
                {consultaPendienteCompletar(consulta) ? "Completar" : "Editar historia"}
              </button>
            ) : (
              <p className="text-xs text-amber-800">
                Historia de otra clínica ({consulta.clinicas?.nombre || "—"}). Solo lectura.
              </p>
            )}
          </div>
        </div>
        {consulta.clinica_id === clinicaId && consultaPendienteCompletar(consulta) ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Historia creada al finalizar el turno. Completá el diagnóstico, tratamiento y demás
            datos de la consulta.
          </p>
        ) : null}
        {consulta.clinica_id === clinicaId && consulta.cerrada ? (
          <p className="mt-3 text-xs text-amber-800">
            Esta consulta está cerrada/firmada. Podés editar el contenido; la firma original se
            conserva.
          </p>
        ) : null}

        {paciente ? (
          <div className="mt-4 rounded-xl bg-stone-50 px-3 py-3 text-sm">
            <p className="font-medium text-aguara-ink">Datos del paciente</p>
            <p className="mt-1 text-stone-600">
              {paciente.especie}
              {paciente.raza ? ` · ${paciente.raza}` : ""}
              {paciente.sexo ? ` · ${paciente.sexo}` : ""}
              {paciente.peso != null ? ` · ${paciente.peso} kg` : ""}
            </p>
            <p className="text-stone-600">
              Tutor: {paciente.clinica_clientes?.nombre_completo || "—"}
              {paciente.clinica_clientes?.telefono
                ? ` · ${paciente.clinica_clientes.telefono}`
                : ""}
            </p>
            {paciente.enfermedad ? (
              <p className="mt-1 text-amber-800">Enfermedad: {paciente.enfermedad}</p>
            ) : null}
            {paciente.alergias ? (
              <p className="mt-1 text-amber-800">Alergias: {paciente.alergias}</p>
            ) : null}
            {paciente.chip || paciente.chapita_codigo || paciente.mascota_chapita_id ? (
              <p className="mt-1 text-stone-500">
                {paciente.chip ? `Chip: ${paciente.chip}` : ""}
                {paciente.mascota_chapita_id || paciente.chapita_codigo
                  ? `${paciente.chip ? " · " : ""}Identificador: ${
                      paciente.mascota_chapita_id || paciente.chapita_codigo
                    }`
                  : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Item
            label="Estado"
            value={
              consulta.cerrada
                ? "Cerrada"
                : consultaPendienteCompletar(consulta)
                  ? "Por completar"
                  : "Abierta"
            }
          />
          <Item label="Motivo" value={consulta.motivo} />
          <Item
            label="Veterinario"
            value={
              consulta.clinica_veterinarios?.nombre
                ? `${consulta.clinica_veterinarios.nombre}${
                    consulta.clinica_veterinarios.matricula
                      ? ` · Mat. ${consulta.clinica_veterinarios.matricula}`
                      : ""
                  }`
                : null
            }
          />
          <Item label="Anamnesis" value={consulta.anamnesis} wide />
          <Item label="Examen físico" value={consulta.examen_fisico} wide />
          <Item
            label="Diagnóstico"
            value={
              consulta.diagnostico
                ? `${consulta.diagnostico}${
                    consulta.incluir_diagnostico_receta ? " · (incluido en receta)" : ""
                  }`
                : null
            }
            wide
          />
          <Item label="Tratamiento" value={consulta.tratamiento} />
          <Item
            label="Medicación"
            value={formatHcMedicacionDisplay(consulta.medicacion) || null}
            wide
          />
          <Item label="Peso" value={consulta.peso != null ? `${consulta.peso} kg` : null} />
          <Item
            label="Temperatura"
            value={consulta.temperatura != null ? `${consulta.temperatura} °C` : null}
          />
          <Item label="Observaciones" value={consulta.observaciones} wide />
          <Item label="Creada" value={formatDateTime(consulta.creado_en)} />
          <Item
            label="Última modificación"
            value={formatDateTime(
              consulta.actualizado_en || consulta.cerrado_en || consulta.creado_en || consulta.fecha,
            )}
          />
        </dl>

        {paciente && consulta.clinica_id === clinicaId ? (
          <div className="mt-5 space-y-3 border-t border-stone-100 pt-4">
            <div>
              <p className="text-sm font-medium text-aguara-ink">Cargar en la ficha del paciente</p>
              <p className="mt-0.5 text-xs text-stone-500">
                Lo que agregues acá también queda en la ficha. El historial previo se ve desde
                Pacientes.
              </p>
              {fichaMsg ? <p className="mt-2 text-sm text-emerald-700">{fichaMsg}</p> : null}
              {fichaErr ? <p className="mt-2 text-sm text-red-700">{fichaErr}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <HcAddBlock
                title="Vacuna"
                open={openAdd === "vacuna"}
                onToggle={() =>
                  setOpenAdd((v) => (v === "vacuna" ? null : "vacuna"))
                }
              >
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!(await confirmGuardar(`la vacuna “${vacunaForm.nombre.trim()}”`))) {
                      return;
                    }
                    setBusyFicha(true);
                    setFichaMsg("");
                    setFichaErr("");
                    try {
                      const fecha =
                        vacunaForm.fecha || new Date().toISOString().slice(0, 10);
                      await crearVacuna(clinicaId, {
                        paciente_id: paciente.id,
                        nombre: vacunaForm.nombre,
                        fecha,
                        proxima_fecha: proximaFechaDesdeAplicacion(fecha),
                        veterinario_id: consulta.veterinario_id || null,
                      });
                      setFichaMsg("Vacuna cargada en la ficha del paciente.");
                      setOpenAdd(null);
                      setVacunaForm({
                        nombre: vacunasParaEspecie(paciente.especie)[0] || "",
                        fecha: new Date().toISOString().slice(0, 10),
                      });
                    } catch (err) {
                      setFichaErr(
                        err instanceof Error ? err.message : "No se pudo cargar la vacuna.",
                      );
                    } finally {
                      setBusyFicha(false);
                    }
                  }}
                >
                  <select
                    required
                    className={fieldClass}
                    value={vacunaForm.nombre}
                    onChange={(e) =>
                      setVacunaForm((f) => ({ ...f, nombre: e.target.value }))
                    }
                  >
                    {vacunasParaEspecie(paciente.especie).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <label className="block text-xs text-stone-500">
                    Fecha de colocación
                    <input
                      type="date"
                      required
                      className={`${fieldClass} mt-1`}
                      value={vacunaForm.fecha}
                      onChange={(e) =>
                        setVacunaForm((f) => ({ ...f, fecha: e.target.value }))
                      }
                    />
                  </label>
                  <button type="submit" className={primaryBtnClass} disabled={busyFicha}>
                    Guardar vacuna
                  </button>
                </form>
              </HcAddBlock>

              <HcAddBlock
                title="Desparasitación"
                open={openAdd === "desparasitacion"}
                onToggle={() =>
                  setOpenAdd((v) => (v === "desparasitacion" ? null : "desparasitacion"))
                }
              >
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      !(await confirmGuardar(
                        `la desparasitación “${despForm.producto.trim()}”`,
                      ))
                    ) {
                      return;
                    }
                    setBusyFicha(true);
                    setFichaMsg("");
                    setFichaErr("");
                    try {
                      await crearDesparasitacion(clinicaId, {
                        paciente_id: paciente.id,
                        ...despForm,
                      });
                      setDespForm({ producto: "", fecha: "", proxima_fecha: "" });
                      setFichaMsg("Desparasitación cargada en la ficha del paciente.");
                      setOpenAdd(null);
                    } catch (err) {
                      setFichaErr(
                        err instanceof Error
                          ? err.message
                          : "No se pudo cargar la desparasitación.",
                      );
                    } finally {
                      setBusyFicha(false);
                    }
                  }}
                >
                  <input
                    required
                    placeholder="Producto"
                    className={fieldClass}
                    value={despForm.producto}
                    onChange={(e) =>
                      setDespForm((v) => ({ ...v, producto: e.target.value }))
                    }
                  />
                  <label className="block text-xs text-stone-500">
                    Fecha de aplicación
                    <input
                      type="date"
                      className={`${fieldClass} mt-1`}
                      value={despForm.fecha}
                      onChange={(e) =>
                        setDespForm((v) => ({ ...v, fecha: e.target.value }))
                      }
                    />
                  </label>
                  <label className="block text-xs text-stone-500">
                    Fecha de caducidad
                    <input
                      type="date"
                      className={`${fieldClass} mt-1`}
                      value={despForm.proxima_fecha}
                      onChange={(e) =>
                        setDespForm((v) => ({ ...v, proxima_fecha: e.target.value }))
                      }
                    />
                  </label>
                  <button type="submit" className={primaryBtnClass} disabled={busyFicha}>
                    Guardar desparasitación
                  </button>
                </form>
              </HcAddBlock>

              <HcAddBlock
                title="Archivo"
                open={openAdd === "archivo"}
                onToggle={() =>
                  setOpenAdd((v) => (v === "archivo" ? null : "archivo"))
                }
              >
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const files = archivoForm.files || [];
                    if (!files.length) {
                      setFichaErr("Seleccioná al menos un archivo del ordenador.");
                      return;
                    }
                    const label =
                      files.length === 1
                        ? `el archivo “${files[0].name}”`
                        : `los ${files.length} archivos seleccionados`;
                    if (!(await confirmGuardar(label))) return;
                    setBusyFicha(true);
                    setFichaMsg("");
                    setFichaErr("");
                    try {
                      await crearArchivosDesdeFiles(clinicaId, {
                        paciente_id: paciente.id,
                        consulta_id: consulta.id,
                        tipo: archivoForm.tipo,
                        files,
                      });
                      setArchivoForm({ tipo: "estudio", files: [] });
                      if (archivoInputRef.current) archivoInputRef.current.value = "";
                      await loadArchivosConsulta(paciente.id, consulta.id);
                      setFichaMsg(
                        files.length === 1
                          ? "Archivo cargado en la ficha del paciente."
                          : `${files.length} archivos cargados en la ficha del paciente.`,
                      );
                      setOpenAdd(null);
                    } catch (err) {
                      setFichaErr(
                        err instanceof Error ? err.message : "No se pudo adjuntar el archivo.",
                      );
                    } finally {
                      setBusyFicha(false);
                    }
                  }}
                >
                  <select
                    className={fieldClass}
                    value={archivoForm.tipo}
                    onChange={(e) =>
                      setArchivoForm((v) => ({ ...v, tipo: e.target.value }))
                    }
                  >
                    <option value="estudio">Estudio</option>
                    <option value="foto">Foto</option>
                    <option value="lab">Laboratorio</option>
                    <option value="receta">Receta</option>
                    <option value="otro">Otro</option>
                  </select>
                  <label className="block text-xs text-stone-500">
                    Archivos del ordenador
                    <input
                      ref={archivoInputRef}
                      required
                      type="file"
                      multiple
                      className={`${fieldClass} mt-1`}
                      onChange={(e) =>
                        setArchivoForm((v) => ({
                          ...v,
                          files: Array.from(e.target.files || []),
                        }))
                      }
                    />
                  </label>
                  {archivoForm.files?.length ? (
                    <ul className="space-y-1 text-xs text-stone-600">
                      {archivoForm.files.map((f) => (
                        <li key={`${f.name}-${f.size}-${f.lastModified}`}>
                          {f.name} · {(f.size / 1024).toFixed(0)} KB
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <button type="submit" className={primaryBtnClass} disabled={busyFicha}>
                    {archivoForm.files?.length > 1 ? "Adjuntar archivos" : "Adjuntar"}
                  </button>
                </form>
              </HcAddBlock>

              <HcAddBlock
                title="Medicación"
                open={openAdd === "medicacion"}
                onToggle={() =>
                  setOpenAdd((v) => (v === "medicacion" ? null : "medicacion"))
                }
              >
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!(await confirmGuardar(`la medicación “${medForm.titulo.trim()}”`))) {
                      return;
                    }
                    setBusyFicha(true);
                    setFichaMsg("");
                    setFichaErr("");
                    try {
                      await crearTratamiento(clinicaId, {
                        paciente_id: paciente.id,
                        titulo: medForm.titulo,
                        detalle: medForm.detalle,
                        fecha_inicio: medForm.fecha_inicio,
                        fecha_fin: medForm.fecha_fin,
                        de_por_vida: medForm.de_por_vida,
                        horarios: normalizeHorarios(medForm.horarios),
                      });
                      setMedForm({
                        titulo: "",
                        detalle: "",
                        fecha_inicio: new Date().toISOString().slice(0, 10),
                        fecha_fin: "",
                        de_por_vida: false,
                        horarios: [""],
                      });
                      setFichaMsg("Medicación cargada en la ficha del paciente.");
                      setOpenAdd(null);
                    } catch (err) {
                      setFichaErr(
                        err instanceof Error ? err.message : "No se pudo cargar la medicación.",
                      );
                    } finally {
                      setBusyFicha(false);
                    }
                  }}
                >
                  <input
                    required
                    placeholder="Nombre del medicamento"
                    className={fieldClass}
                    value={medForm.titulo}
                    onChange={(e) => setMedForm((v) => ({ ...v, titulo: e.target.value }))}
                  />
                  <input
                    placeholder="Detalle / dosis"
                    className={fieldClass}
                    value={medForm.detalle}
                    onChange={(e) => setMedForm((v) => ({ ...v, detalle: e.target.value }))}
                  />
                  <label className="block text-xs text-stone-500">
                    Inicio
                    <input
                      type="date"
                      required
                      className={`${fieldClass} mt-1`}
                      value={medForm.fecha_inicio}
                      onChange={(e) =>
                        setMedForm((v) => ({ ...v, fecha_inicio: e.target.value }))
                      }
                    />
                  </label>
                  <MedicacionExtrasFields
                    fieldClass={fieldClass}
                    horarios={medForm.horarios}
                    onHorariosChange={(horarios) => setMedForm((v) => ({ ...v, horarios }))}
                    dePorVida={medForm.de_por_vida}
                    onDePorVidaChange={(de_por_vida) =>
                      setMedForm((v) => ({
                        ...v,
                        de_por_vida,
                        fecha_fin: de_por_vida ? "" : v.fecha_fin,
                      }))
                    }
                    fechaFin={medForm.fecha_fin}
                    onFechaFinChange={(fecha_fin) =>
                      setMedForm((v) => ({ ...v, fecha_fin }))
                    }
                    fechaFinLabel="Fecha de finalización"
                  />
                  <button type="submit" className={primaryBtnClass} disabled={busyFicha}>
                    Guardar medicación
                  </button>
                </form>
              </HcAddBlock>
            </div>
          </div>
        ) : null}
        {consulta.cerrada ? (
          <div className="mt-4 space-y-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            <p>
              Consulta cerrada · Firmado por {consulta.firmado_por || "—"} ·{" "}
              {formatDateTime(consulta.cerrado_en)}
            </p>
            {consulta.firma_imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={consulta.firma_imagen}
                alt="Firma digital"
                className="mt-1 h-16 w-40 rounded border border-emerald-200 bg-white object-contain"
              />
            ) : null}
            {consulta.clinica_id === clinicaId && paciente ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  className={primaryBtnClass}
                  disabled={Boolean(recetaBusy)}
                  onClick={abrirReceta}
                >
                  {recetaBusy === "abrir" ? "Preparando…" : "Crear receta"}
                </button>
                {!formatHcMedicacionLines(consulta.medicacion).length ? (
                  <p className="text-xs text-amber-800">
                    Agregá medicación en la historia para poder generar la receta.
                  </p>
                ) : null}
              </div>
            ) : null}
            {recetaError && !recetaOpen ? (
              <p className="text-sm text-red-700" role="alert">
                {recetaError}
              </p>
            ) : null}
          </div>
        ) : consulta.clinica_id === clinicaId ? (
          <div className="mt-5 space-y-3 border-t border-stone-100 pt-4">
            <Field label="Veterinario que firma" id="hc-firma-vet">
              <select
                id="hc-firma-vet"
                className={fieldClass}
                value={firmaVetId}
                onChange={(e) => setFirmaVetId(e.target.value)}
              >
                <option value="">Seleccionar veterinario…</option>
                {vets.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                    {v.matricula ? ` · Mat. ${v.matricula}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            {firmaVetId ? (
              (() => {
                const vet = vets.find((v) => v.id === firmaVetId);
                if (!vet?.firma_digital) {
                  return (
                    <p className="text-sm text-amber-800">
                      Ese veterinario no tiene firma digital. Registrate en Configuración →
                      Veterinarios.
                    </p>
                  );
                }
                return (
                  <div className="flex flex-wrap items-end gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={vet.firma_digital}
                      alt={`Firma de ${vet.nombre}`}
                      className="h-16 w-40 rounded border border-stone-200 bg-white object-contain"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      className={primaryBtnClass}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const firmadoPor = `${vet.nombre}${
                            vet.matricula ? ` · Mat. ${vet.matricula}` : ""
                          }`;
                          await cerrarConsulta(consulta.id, {
                            firmadoPor,
                            firmaImagen: vet.firma_digital,
                            clinicaId,
                          });
                          await load();
                          await onChanged();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "No se pudo cerrar.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Cerrar / firmar consulta
                    </button>
                  </div>
                );
              })()
            ) : null}
          </div>
        ) : null}

        {archivosConsulta.length ? (
          <div className="mt-5 space-y-2 border-t border-stone-100 pt-4">
            <p className="text-sm font-medium text-aguara-ink">Archivos de esta historia</p>
            <ul className="space-y-1.5 text-sm">
              {archivosConsulta.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                    {a.tipo || "archivo"}
                  </span>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-aguara-orange hover:underline"
                  >
                    {a.nombre}
                  </a>
                  <span className="text-xs text-stone-400">{formatDateTime(a.creado_en)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {recetaOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/50 p-4 sm:p-8">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3 sm:px-5">
              <div>
                <p className="text-sm font-medium text-aguara-orange">Vista previa</p>
                <h3 className="text-lg font-semibold text-aguara-ink">Receta</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryBtnClass}
                  disabled={Boolean(recetaBusy)}
                  onClick={() => {
                    setRecetaOpen(false);
                    setRecetaError("");
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={secondaryBtnClass}
                  disabled={Boolean(recetaBusy)}
                  onClick={descargarRecetaJpeg}
                >
                  {recetaBusy === "descargar" ? "Descargando…" : "Descargar"}
                </button>
                <button
                  type="button"
                  className={primaryBtnClass}
                  disabled={Boolean(recetaBusy)}
                  onClick={guardarRecetaJpeg}
                >
                  {recetaBusy === "guardar" ? "Guardando…" : "Guardar receta JPEG"}
                </button>
              </div>
            </div>
            {recetaError ? (
              <p className="px-4 pt-3 text-sm text-red-700 sm:px-5" role="alert">
                {recetaError}
              </p>
            ) : null}
            <div className="overflow-x-auto bg-stone-100 p-4 sm:p-6">
              <div className="mx-auto w-fit shadow-md">
                <RecetaDocumento
                  ref={recetaRef}
                  clinica={recetaClinica}
                  paciente={paciente}
                  cliente={recetaCliente}
                  medicacion={consulta.medicacion}
                  diagnostico={
                    consulta.incluir_diagnostico_receta ? consulta.diagnostico : ""
                  }
                  firmaImagen={consulta.firma_imagen}
                  firmadoPor={consulta.firmado_por}
                  fechaHoy={formatDate(new Date())}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Item({ label, value, wide }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-stone-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-aguara-ink">{value || "—"}</dd>
    </div>
  );
}

function HcAddBlock({ title, open, onToggle, children }) {
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/60 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-aguara-ink">{title}</h3>
        <button
          type="button"
          aria-label={open ? `Cerrar ${title}` : `Agregar ${title}`}
          aria-expanded={open}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 bg-white text-lg font-semibold leading-none text-aguara-ink hover:border-aguara-orange hover:text-aguara-orange"
          onClick={onToggle}
        >
          {open ? "×" : "+"}
        </button>
      </div>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
