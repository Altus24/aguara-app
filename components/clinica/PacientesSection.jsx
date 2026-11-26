"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import CitaForm from "@/components/clinica/CitaForm";
import { ConsultaForm, DetalleConsulta } from "@/components/clinica/HistoriasSection";
import useClinicaCabeceraOptions from "@/components/clinica/useClinicaCabeceraOptions";
import {
  cardClass,
  Field,
  fieldClass,
  formatDate,
  formatDateTime,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/clinica/ui";
import MascotaRegistroFields, {
  emptyPetFormConCabecera,
  validateMascotaRegistroForm,
} from "@/components/mascotas/MascotaRegistroFields";
import MedicacionExtrasFields, {
  formatHorariosLabel,
  normalizeHorarios,
} from "@/components/mascotas/MedicacionExtrasFields";
import VacunasCatalogoList from "@/components/mascotas/VacunasCatalogoList";
import {
  actualizarVacuna,
  consultaPendienteCompletar,
  crearArchivosDesdeFiles,
  crearCliente,
  crearDesparasitacion,
  crearPaciente,
  crearRecordatorio,
  crearVacuna,
  listarArchivosPacienteCompletas,
  listarClientes,
  listarConsultas,
  listarDesparasitacionesPacienteCompletas,
  listarPacientes,
  listarRecordatoriosPaciente,
  listarTratamientosPaciente,
  listarVacunasPacienteCompletas,
  listarVeterinarios,
  obtenerPaciente,
} from "@/lib/chapitas/clinicaOps";
import { listarServiciosActivos } from "@/lib/chapitas/clinicas";
import { crearTratamiento } from "@/lib/chapitas/mascotaPerfil";
import { supabase } from "@/lib/chapitas/supabaseClient";
import { confirmGuardar } from "@/lib/confirmAction";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const FICHA_NUEVO = "__nuevo__";

export default function PacientesSection({ clinicaId }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function reload(search = q) {
    setLoading(true);
    setError("");
    try {
      const [pacientes, clients] = await Promise.all([
        listarPacientes(clinicaId, search),
        listarClientes(clinicaId),
      ]);
      setItems(pacientes);
      setClientes(clients);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar pacientes.");
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
      <FichaPaciente
        clinicaId={clinicaId}
        pacienteId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-aguara-ink">Pacientes</h2>
          <p className="text-sm text-stone-500">Listado de mascotas de la clínica</p>
        </div>
        <button type="button" className={primaryBtnClass} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cerrar" : "Nueva mascota"}
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, especie o raza"
          className={fieldClass}
        />
        <button type="button" className={secondaryBtnClass} onClick={() => reload(q)}>
          Buscar
        </button>
      </div>

      {showForm ? (
        <NuevoPacienteForm
          clinicaId={clinicaId}
          clientes={clientes}
          onCreated={async () => {
            setShowForm(false);
            await reload();
          }}
          onClientCreated={async () => {
            setClientes(await listarClientes(clinicaId));
          }}
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
        ) : items.length === 0 ? (
          <p className="text-sm text-stone-500">Todavía no hay pacientes cargados.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {items.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-stone-50"
                >
                  <div>
                    <p className="font-medium text-aguara-ink">{p.nombre}</p>
                    <p className="text-sm text-stone-500">
                      {p.especie}
                      {p.raza ? ` · ${p.raza}` : ""} · Dueño:{" "}
                      {p.clinica_clientes?.nombre_completo || "—"}
                    </p>
                  </div>
                  <span className="text-sm text-aguara-orange">Ver ficha</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NuevoPacienteForm({ clinicaId, clientes, onCreated, onClientCreated }) {
  const [form, setForm] = useState(() => ({
    cliente_id: "",
    chapita_codigo: "",
    nuevo_cliente_nombre: "",
    nuevo_cliente_email: "",
    nuevo_cliente_telefono: "",
    nuevo_cliente_telefono_secundario: "",
    nuevo_cliente_direccion: "",
    ...emptyPetFormConCabecera(clinicaId),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [crearDueño, setCrearDueño] = useState(false);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);
  const clinicasCabecera = useClinicaCabeceraOptions(clinicaId);

  useEffect(() => {
    setForm((f) =>
      f.clinica_cabecera_id === clinicaId ? f : { ...f, clinica_cabecera_id: clinicaId || "" },
    );
  }, [clinicaId]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  function handlePhoto(event) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
      setFoto(null);
      setPreview(null);
      return;
    }
    if (!PHOTO_TYPES.has(file.type)) {
      setError("La foto tiene que ser JPG, PNG o WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("La foto no puede superar 4 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setFoto(file);
    setPreview(url);
  }

  async function uploadFotoPaciente() {
    if (!foto) return null;
    const extension =
      foto.type === "image/png" ? "png" : foto.type === "image/webp" ? "webp" : "jpg";
    const path = `clinica/${clinicaId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("mascotas-fotos")
      .upload(path, foto, { contentType: foto.type, upsert: false });
    if (uploadError) {
      throw new Error(
        /bucket not found/i.test(uploadError.message)
          ? "Falta el bucket mascotas-fotos."
          : "No se pudo subir la foto.",
      );
    }
    const { data } = supabase.storage.from("mascotas-fotos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const invalid = validateMascotaRegistroForm(form);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!(await confirmGuardar("el nuevo paciente"))) return;
    setSaving(true);
    setError("");
    try {
      let clienteId = form.cliente_id;
      if (crearDueño) {
        if (!form.nuevo_cliente_nombre.trim() || !form.nuevo_cliente_telefono.trim()) {
          throw new Error("Completá nombre y teléfono del dueño.");
        }
        if (!form.nuevo_cliente_email.trim()) {
          throw new Error("El email del dueño es obligatorio para que figure en Tutores Aguará.");
        }
        const cliente = await crearCliente(clinicaId, {
          nombre_completo: form.nuevo_cliente_nombre,
          email: form.nuevo_cliente_email,
          telefono: form.nuevo_cliente_telefono,
          telefono_secundario: form.nuevo_cliente_telefono_secundario,
          direccion: form.nuevo_cliente_direccion,
        });
        clienteId = cliente.id;
        await onClientCreated();
      }
      if (!clienteId) throw new Error("Seleccioná o creá un dueño.");
      const fotoUrl = await uploadFotoPaciente();
      await crearPaciente(clinicaId, {
        cliente_id: clienteId,
        nombre: form.nombre_mascota,
        especie: form.especie,
        raza: form.raza,
        sexo: form.sexo,
        castrado: form.castrado,
        fecha_nacimiento: form.fecha_nacimiento,
        peso: form.peso,
        nro_chip: form.nro_chip,
        enfermedad: form.enfermedad,
        medicacion: form.medicacion,
        datos_adicionales: form.datos_adicionales,
        foto_url: fotoUrl,
        chapita_codigo: form.chapita_codigo,
        clinica_cabecera_id: form.clinica_cabecera_id || clinicaId,
        clinica_ref_nombre: form.clinica_ref_nombre,
        clinica_ref_direccion: form.clinica_ref_direccion,
        clinica_ref_telefono: form.clinica_ref_telefono,
      });
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-4`}>
      <h3 className="font-semibold text-aguara-ink">Nueva mascota</h3>
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          checked={crearDueño}
          onChange={(e) => setCrearDueño(e.target.checked)}
        />
        Crear dueño nuevo
      </label>
      {crearDueño ? (
        <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
          <p className="text-sm font-medium text-aguara-ink">Datos del dueño</p>
          <p className="text-xs text-stone-500">
            Con email y teléfono también queda como tutor Aguará y aparece en el buscador de
            Tutores.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre completo *" id="np-dueno">
              <input
                id="np-dueno"
                required
                className={fieldClass}
                value={form.nuevo_cliente_nombre}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nuevo_cliente_nombre: e.target.value }))
                }
              />
            </Field>
            <Field label="Teléfono *" id="np-tel">
              <input
                id="np-tel"
                type="tel"
                required
                className={fieldClass}
                value={form.nuevo_cliente_telefono}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nuevo_cliente_telefono: e.target.value }))
                }
              />
            </Field>
            <Field label="Email *" id="np-email">
              <input
                id="np-email"
                type="email"
                required
                className={fieldClass}
                value={form.nuevo_cliente_email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nuevo_cliente_email: e.target.value }))
                }
              />
            </Field>
            <Field label="Tel. secundario" id="np-tel2">
              <input
                id="np-tel2"
                type="tel"
                className={fieldClass}
                value={form.nuevo_cliente_telefono_secundario}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    nuevo_cliente_telefono_secundario: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Dirección" id="np-dir" className="sm:col-span-2">
              <input
                id="np-dir"
                className={fieldClass}
                value={form.nuevo_cliente_direccion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nuevo_cliente_direccion: e.target.value }))
                }
              />
            </Field>
          </div>
        </div>
      ) : (
        <Field label="Dueño *" id="np-cliente">
          <select
            id="np-cliente"
            required
            className={fieldClass}
            value={form.cliente_id}
            onChange={(e) => setForm((f) => ({ ...f, cliente_id: e.target.value }))}
          >
            <option value="">Seleccionar…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre_completo}
                {c.telefono ? ` · ${c.telefono}` : ""}
              </option>
            ))}
          </select>
        </Field>
      )}

      <MascotaRegistroFields
        form={form}
        onChange={(name, value) => setForm((f) => ({ ...f, [name]: value }))}
        preview={preview}
        onPhoto={handlePhoto}
        fieldClass={fieldClass}
        fotoInputId="np-foto"
        clinicas={clinicasCabecera}
      />

      <Field label="Código identificador (opcional)" id="np-chapita">
        <input
          id="np-chapita"
          className={fieldClass}
          placeholder="Ej. T1-004 — dejar vacío si aún no tiene"
          value={form.chapita_codigo}
          onChange={(e) => setForm((f) => ({ ...f, chapita_codigo: e.target.value }))}
        />
      </Field>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={saving} className={primaryBtnClass}>
        {saving ? "Guardando…" : "Guardar paciente"}
      </button>
    </form>
  );
}

function FichaPaciente({ clinicaId, pacienteId, onBack }) {
  const [paciente, setPaciente] = useState(null);
  const [consultas, setConsultas] = useState([]);
  const [vacunas, setVacunas] = useState([]);
  const [desparas, setDesparas] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [recordatorios, setRecordatorios] = useState([]);
  const [tratamientos, setTratamientos] = useState([]);
  const [vets, setVets] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCitaForm, setShowCitaForm] = useState(false);
  const [showHcForm, setShowHcForm] = useState(false);
  const [selectedConsultaId, setSelectedConsultaId] = useState(null);
  const [citaMsg, setCitaMsg] = useState("");
  const [busyFicha, setBusyFicha] = useState(false);
  const [fichaMsg, setFichaMsg] = useState("");
  const [fichaErr, setFichaErr] = useState("");
  const [despSel, setDespSel] = useState(FICHA_NUEVO);
  const [archivoSel, setArchivoSel] = useState(FICHA_NUEVO);
  const [recordatorioSel, setRecordatorioSel] = useState(FICHA_NUEVO);
  const [tratamientoSel, setTratamientoSel] = useState(FICHA_NUEVO);
  const [despForm, setDespForm] = useState({ producto: "", fecha: "", proxima_fecha: "" });
  const [archivoForm, setArchivoForm] = useState({ tipo: "estudio", files: [] });
  const archivoInputRef = useRef(null);
  const [recordatorioForm, setRecordatorioForm] = useState({
    tipo: "medicacion",
    titulo: "",
    detalle: "",
    fecha_proxima: "",
    de_por_vida: false,
    horarios: [""],
  });
  const [tratamientoForm, setTratamientoForm] = useState({
    titulo: "",
    detalle: "",
    fecha_inicio: "",
    fecha_fin: "",
    de_por_vida: false,
    horarios: [""],
  });

  function syncSeleccion(items, setCurrent) {
    setCurrent((prev) => {
      if (!items.length) return FICHA_NUEVO;
      if (prev !== FICHA_NUEVO && items.some((item) => String(item.id) === String(prev))) {
        return String(prev);
      }
      return String(items[0].id);
    });
  }

  async function reloadFicha() {
    const p = await obtenerPaciente(pacienteId);
    const [c, v, d, a, rec, trat, vetsRows, serviciosRows, clientesRows] = await Promise.all([
      listarConsultas(clinicaId, { pacienteId }),
      listarVacunasPacienteCompletas(p, { clinicaId }),
      listarDesparasitacionesPacienteCompletas(p, { clinicaId }),
      listarArchivosPacienteCompletas(p, { clinicaId }),
      listarRecordatoriosPaciente(pacienteId),
      listarTratamientosPaciente(pacienteId),
      listarVeterinarios(clinicaId),
      listarServiciosActivos(clinicaId),
      listarClientes(clinicaId),
    ]);
    setPaciente(p);
    setConsultas(c);
    setVacunas(v);
    setDesparas(d);
    setArchivos(a);
    setRecordatorios(rec);
    setTratamientos(trat);
    setVets((vetsRows || []).filter((vet) => vet.activo !== false));
    setServicios(serviciosRows || []);
    setClientes(clientesRows || []);
    syncSeleccion(d, setDespSel);
    syncSeleccion(a, setArchivoSel);
    syncSeleccion(rec, setRecordatorioSel);
    syncSeleccion(trat, setTratamientoSel);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        await reloadFicha();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar ficha.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId, pacienteId]);

  if (loading) return <p className="text-sm text-stone-500">Cargando ficha…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!paciente) return null;

  if (selectedConsultaId) {
    return (
      <DetalleConsulta
        clinicaId={clinicaId}
        consultaId={selectedConsultaId}
        vets={vets}
        onBack={() => setSelectedConsultaId(null)}
        onChanged={async () => {
          await reloadFicha();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={secondaryBtnClass} onClick={onBack}>
          ← Volver al listado
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryBtnClass}
            onClick={() => {
              setCitaMsg("");
              setShowHcForm(false);
              setShowCitaForm((v) => !v);
            }}
          >
            {showCitaForm ? "Cerrar cita" : "Programar cita"}
          </button>
          <button
            type="button"
            className={primaryBtnClass}
            onClick={() => {
              setCitaMsg("");
              setShowCitaForm(false);
              setShowHcForm((v) => !v);
            }}
          >
            {showHcForm ? "Cerrar" : "Nueva historia clínica"}
          </button>
        </div>
      </div>

      <div className={cardClass}>
        <h2 className="text-2xl font-semibold text-aguara-ink">{paciente.nombre}</h2>
        <p className="mt-1 text-sm text-stone-600">
          {paciente.especie}
          {paciente.raza ? ` · ${paciente.raza}` : ""}
          {paciente.sexo ? ` · ${paciente.sexo}` : ""}
          {paciente.peso ? ` · ${paciente.peso} kg` : ""}
        </p>
        <p className="mt-3 text-sm text-stone-700">
          Dueño: <strong>{paciente.clinica_clientes?.nombre_completo}</strong>
          {paciente.clinica_clientes?.telefono
            ? ` · ${paciente.clinica_clientes.telefono}`
            : ""}
        </p>
        {paciente.enfermedad ? (
          <p className="mt-2 text-sm text-amber-800">Enfermedad: {paciente.enfermedad}</p>
        ) : null}
        {paciente.alergias ? (
          <p className="mt-1 text-sm text-amber-800">Alergias: {paciente.alergias}</p>
        ) : null}
        {paciente.chip ? <p className="mt-1 text-sm text-stone-500">Chip: {paciente.chip}</p> : null}
      </div>

      {citaMsg ? <p className="text-sm text-emerald-700">{citaMsg}</p> : null}

      {showCitaForm ? (
        <CitaForm
          clinicaId={clinicaId}
          pacientes={[paciente]}
          clientes={clientes}
          vets={vets}
          servicios={servicios}
          lockPaciente
          omitirPendiente
          initial={{
            paciente_id: paciente.id,
            cliente_id: paciente.cliente_id || paciente.clinica_clientes?.id || "",
            estado: "confirmada",
          }}
          defaultDay={new Date()}
          onCancel={() => setShowCitaForm(false)}
          onSaved={async () => {
            setShowCitaForm(false);
            setCitaMsg(`Cita programada para ${paciente.nombre}.`);
          }}
        />
      ) : null}

      {showHcForm ? (
        <ConsultaForm
          clinicaId={clinicaId}
          pacientes={[paciente]}
          clientes={
            paciente.clinica_clientes
              ? [paciente.clinica_clientes]
              : clientes.filter(
                  (c) => c.id === (paciente.cliente_id || paciente.clinica_clientes?.id),
                )
          }
          vets={vets}
          lockPaciente
          initial={{
            paciente_id: paciente.id,
            cliente_id: paciente.cliente_id || paciente.clinica_clientes?.id || "",
          }}
          onCancel={() => setShowHcForm(false)}
          onSaved={async () => {
            setShowHcForm(false);
            setCitaMsg(`Historia clínica creada para ${paciente.nombre}.`);
            await reloadFicha();
          }}
        />
      ) : null}

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Historial completo</h3>
        <p className="mt-1 text-xs text-stone-500">
          Incluye historias de otras clínicas con el mismo identificador (solo lectura).
        </p>
        {consultas.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Sin consultas registradas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {consultas.map((c) => {
              const porCompletar = consultaPendienteCompletar(c);
              const propia = !c.clinica_id || c.clinica_id === clinicaId;
              return (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-aguara-ink">
                      {formatDateTime(c.fecha)}
                      {c.cerrada
                        ? " · Cerrada"
                        : porCompletar
                          ? " · Por completar"
                          : " · Abierta"}
                      {!propia
                        ? ` · compartida (${c.clinicas?.nombre || "otra clínica"})`
                        : ""}
                      {porCompletar ? (
                        <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                          Completar
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-stone-600">{c.motivo || "Consulta"}</p>
                    {c.diagnostico ? (
                      <p className="mt-1 text-sm text-stone-700">Dx: {c.diagnostico}</p>
                    ) : null}
                    {c.tratamiento ? (
                      <p className="text-sm text-stone-700">Tx: {c.tratamiento}</p>
                    ) : null}
                    {c.medicacion ? (
                      <p className="text-sm text-stone-700">Med: {c.medicacion}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={porCompletar && propia ? primaryBtnClass : secondaryBtnClass}
                    onClick={() => setSelectedConsultaId(c.id)}
                  >
                    {porCompletar && propia ? "Completar" : "Ver"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-base font-semibold text-aguara-ink">Cargar en la ficha</h3>
        <p className="mt-1 text-sm text-stone-500">
          Revisá colocaciones previas o agregá una nueva.
        </p>
        {fichaMsg ? <p className="mt-2 text-sm text-emerald-700">{fichaMsg}</p> : null}
        {fichaErr ? <p className="mt-2 text-sm text-red-700">{fichaErr}</p> : null}
      </div>

      <div className={`${cardClass} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-aguara-ink">Vacunas</h3>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
            Catálogo completo · vencimiento a 1 año
          </span>
        </div>
        <VacunasCatalogoList
          especie={paciente.especie}
          vacunas={vacunas}
          formatDate={formatDate}
          fieldClass={fieldClass}
          primaryBtnClass={primaryBtnClass}
          secondaryBtnClass={secondaryBtnClass}
          busy={busyFicha}
          canUpdateVacuna={(v) => v.origen !== "tutor"}
          onRegistrar={async ({ nombre, fecha, proxima_fecha }) => {
            setBusyFicha(true);
            setFichaMsg("");
            setFichaErr("");
            try {
              await crearVacuna(clinicaId, {
                paciente_id: paciente.id,
                nombre,
                fecha,
                proxima_fecha,
              });
              setFichaMsg("Vacuna registrada.");
              await reloadFicha();
            } finally {
              setBusyFicha(false);
            }
          }}
          onActualizarFecha={async (vacuna, { fecha, proxima_fecha }) => {
            if (vacuna.origen === "tutor") {
              throw new Error("Las vacunas del tutor se actualizan desde el portal del tutor.");
            }
            setBusyFicha(true);
            setFichaMsg("");
            setFichaErr("");
            try {
              await actualizarVacuna(vacuna.id, {
                nombre: vacuna.nombre,
                fecha,
                proxima_fecha,
                lote: vacuna.lote || null,
                notas: vacuna.notas || null,
                veterinario_id: vacuna.veterinario_id || null,
              });
              setFichaMsg("Fecha de vacuna actualizada.");
              await reloadFicha();
            } finally {
              setBusyFicha(false);
            }
          }}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <FichaColocacionCard
          title="Desparasitación"
          items={desparas}
          selected={despSel}
          onSelect={setDespSel}
          emptyLabel="Sin desparasitaciones previas."
          optionLabel={(d) => `${d.producto} · ${formatDate(d.fecha)}`}
          renderDetalle={(d) => (
            <div className="space-y-1 text-sm text-stone-700">
              <p>
                <strong>{d.producto}</strong>
              </p>
              <p>Aplicada: {formatDate(d.fecha) || "—"}</p>
              <p>Caducidad: {formatDate(d.proxima_fecha) || "—"}</p>
            </div>
          )}
          form={
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!(await confirmGuardar(`la desparasitación “${despForm.producto.trim()}”`))) {
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
                  setFichaMsg("Desparasitación agregada.");
                  await reloadFicha();
                } catch (err) {
                  setFichaErr(
                    err instanceof Error ? err.message : "No se pudo agregar la desparasitación.",
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
                onChange={(e) => setDespForm((v) => ({ ...v, producto: e.target.value }))}
              />
              <label className="block text-xs text-stone-500">
                Fecha de aplicación
                <input
                  type="date"
                  className={`${fieldClass} mt-1`}
                  value={despForm.fecha}
                  onChange={(e) => setDespForm((v) => ({ ...v, fecha: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-stone-500">
                Fecha de caducidad
                <input
                  type="date"
                  className={`${fieldClass} mt-1`}
                  value={despForm.proxima_fecha}
                  onChange={(e) => setDespForm((v) => ({ ...v, proxima_fecha: e.target.value }))}
                />
              </label>
              <p className="text-xs text-stone-400">
                Si cargás caducidad, aparece en los recordatorios del tutor.
              </p>
              <button type="submit" className={primaryBtnClass} disabled={busyFicha}>
                Agregar
              </button>
            </form>
          }
        />

        <FichaColocacionCard
          title="Archivo"
          items={archivos}
          selected={archivoSel}
          onSelect={setArchivoSel}
          emptyLabel="Sin archivos previos."
          optionLabel={(a) => `${a.nombre} · ${a.tipo}`}
          renderDetalle={(a) => (
            <div className="space-y-1 text-sm text-stone-700">
              <p>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-aguara-orange hover:underline"
                >
                  {a.nombre}
                </a>{" "}
                <span className="text-stone-500">({a.tipo})</span>
              </p>
              <p className="text-xs text-stone-500">{formatDateTime(a.creado_en)}</p>
            </div>
          )}
          form={
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
                    consulta_id: null,
                    tipo: archivoForm.tipo,
                    files,
                  });
                  setArchivoForm({ tipo: "estudio", files: [] });
                  if (archivoInputRef.current) archivoInputRef.current.value = "";
                  setFichaMsg(
                    files.length === 1
                      ? "Archivo adjuntado."
                      : `${files.length} archivos adjuntados.`,
                  );
                  await reloadFicha();
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
                onChange={(e) => setArchivoForm((v) => ({ ...v, tipo: e.target.value }))}
              >
                <option value="estudio">Estudio</option>
                <option value="foto">Foto</option>
                <option value="lab">Laboratorio</option>
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
              <p className="text-xs text-stone-400">
                Podés elegir varios (PDF, imágenes, Word, etc.). Máx. 20 MB c/u.
              </p>
            </form>
          }
        />

        <FichaColocacionCard
          title="Recordatorio tutor"
          items={recordatorios}
          selected={recordatorioSel}
          onSelect={setRecordatorioSel}
          emptyLabel="Sin recordatorios previos."
          optionLabel={(r) =>
            `${r.titulo}${
              r.de_por_vida
                ? " · de por vida"
                : r.fecha_proxima
                  ? ` · ${formatDate(r.fecha_proxima)}`
                  : ""
            }${formatHorariosLabel(r.horarios) ? ` · ${formatHorariosLabel(r.horarios)}` : ""}`
          }
          renderDetalle={(r) => (
            <div className="space-y-1 text-sm text-stone-700">
              <p>
                <strong>{r.titulo}</strong>{" "}
                <span className="text-stone-500">({r.tipo})</span>
                {r.activo === false ? (
                  <span className="ml-2 text-xs text-stone-400">Inactivo</span>
                ) : null}
              </p>
              {r.detalle ? <p>{r.detalle}</p> : null}
              <p>
                {r.de_por_vida
                  ? "De por vida"
                  : `Fecha: ${formatDate(r.fecha_proxima) || "—"}`}
              </p>
              {formatHorariosLabel(r.horarios) ? (
                <p>Horarios: {formatHorariosLabel(r.horarios)}</p>
              ) : null}
            </div>
          )}
          form={
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!(await confirmGuardar(`el recordatorio “${recordatorioForm.titulo.trim()}”`))) {
                  return;
                }
                setBusyFicha(true);
                setFichaMsg("");
                setFichaErr("");
                try {
                  await crearRecordatorio(clinicaId, {
                    paciente_id: paciente.id,
                    cliente_id: paciente.cliente_id || paciente.clinica_clientes?.id || null,
                    ...recordatorioForm,
                    horarios: normalizeHorarios(recordatorioForm.horarios),
                  });
                  setRecordatorioForm({
                    tipo: "medicacion",
                    titulo: "",
                    detalle: "",
                    fecha_proxima: "",
                    de_por_vida: false,
                    horarios: [""],
                  });
                  setFichaMsg("Recordatorio cargado para el tutor.");
                  await reloadFicha();
                } catch (err) {
                  setFichaErr(
                    err instanceof Error ? err.message : "No se pudo cargar el recordatorio.",
                  );
                } finally {
                  setBusyFicha(false);
                }
              }}
            >
              <select
                className={fieldClass}
                value={recordatorioForm.tipo}
                onChange={(e) => setRecordatorioForm((v) => ({ ...v, tipo: e.target.value }))}
              >
                <option value="medicacion">Medicación</option>
                <option value="control">Control</option>
                <option value="vacuna">Vacuna</option>
                <option value="otro">Otro</option>
              </select>
              <input
                required
                placeholder="Título"
                className={fieldClass}
                value={recordatorioForm.titulo}
                onChange={(e) => setRecordatorioForm((v) => ({ ...v, titulo: e.target.value }))}
              />
              <input
                placeholder="Detalle / dosis"
                className={fieldClass}
                value={recordatorioForm.detalle}
                onChange={(e) => setRecordatorioForm((v) => ({ ...v, detalle: e.target.value }))}
              />
              {recordatorioForm.tipo === "medicacion" ? (
                <MedicacionExtrasFields
                  fieldClass={fieldClass}
                  horarios={recordatorioForm.horarios}
                  onHorariosChange={(horarios) =>
                    setRecordatorioForm((v) => ({ ...v, horarios }))
                  }
                  dePorVida={recordatorioForm.de_por_vida}
                  onDePorVidaChange={(de_por_vida) =>
                    setRecordatorioForm((v) => ({
                      ...v,
                      de_por_vida,
                      fecha_proxima: de_por_vida ? "" : v.fecha_proxima,
                    }))
                  }
                  fechaFin={recordatorioForm.fecha_proxima}
                  onFechaFinChange={(fecha_proxima) =>
                    setRecordatorioForm((v) => ({ ...v, fecha_proxima }))
                  }
                  fechaFinLabel="Hasta / próxima fecha"
                />
              ) : (
                <input
                  type="date"
                  className={fieldClass}
                  value={recordatorioForm.fecha_proxima}
                  onChange={(e) =>
                    setRecordatorioForm((v) => ({ ...v, fecha_proxima: e.target.value }))
                  }
                />
              )}
              <button type="submit" className={primaryBtnClass} disabled={busyFicha}>
                Cargar para el tutor
              </button>
            </form>
          }
        />

        <FichaColocacionCard
          title="Tratamiento activo"
          items={tratamientos}
          selected={tratamientoSel}
          onSelect={setTratamientoSel}
          emptyLabel="Sin tratamientos previos."
          optionLabel={(t) =>
            `${t.titulo}${t.de_por_vida ? " · de por vida" : t.fecha_fin ? ` · hasta ${formatDate(t.fecha_fin)}` : ""}${
              formatHorariosLabel(t.horarios) ? ` · ${formatHorariosLabel(t.horarios)}` : ""
            }`
          }
          renderDetalle={(t) => (
            <div className="space-y-1 text-sm text-stone-700">
              <p>
                <strong>{t.titulo}</strong>
                {t.activo === false ? (
                  <span className="ml-2 text-xs text-stone-400">Inactivo</span>
                ) : null}
              </p>
              {t.detalle ? <p>{t.detalle}</p> : null}
              <p>Inicio: {formatDate(t.fecha_inicio) || "—"}</p>
              <p>
                {t.de_por_vida
                  ? "De por vida"
                  : `Fin: ${formatDate(t.fecha_fin) || "—"}`}
              </p>
              {formatHorariosLabel(t.horarios) ? (
                <p>Horarios: {formatHorariosLabel(t.horarios)}</p>
              ) : null}
            </div>
          )}
          form={
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!(await confirmGuardar(`el tratamiento “${tratamientoForm.titulo.trim()}”`))) {
                  return;
                }
                setBusyFicha(true);
                setFichaMsg("");
                setFichaErr("");
                try {
                  await crearTratamiento(clinicaId, {
                    paciente_id: paciente.id,
                    ...tratamientoForm,
                    horarios: normalizeHorarios(tratamientoForm.horarios),
                  });
                  setTratamientoForm({
                    titulo: "",
                    detalle: "",
                    fecha_inicio: "",
                    fecha_fin: "",
                    de_por_vida: false,
                    horarios: [""],
                  });
                  setFichaMsg("Tratamiento guardado.");
                  await reloadFicha();
                } catch (err) {
                  setFichaErr(
                    err instanceof Error ? err.message : "No se pudo guardar el tratamiento.",
                  );
                } finally {
                  setBusyFicha(false);
                }
              }}
            >
              <input
                required
                placeholder="Nombre del tratamiento"
                className={fieldClass}
                value={tratamientoForm.titulo}
                onChange={(e) => setTratamientoForm((v) => ({ ...v, titulo: e.target.value }))}
              />
              <input
                placeholder="Detalle / indicaciones"
                className={fieldClass}
                value={tratamientoForm.detalle}
                onChange={(e) => setTratamientoForm((v) => ({ ...v, detalle: e.target.value }))}
              />
              <input
                type="date"
                className={fieldClass}
                value={tratamientoForm.fecha_inicio}
                onChange={(e) =>
                  setTratamientoForm((v) => ({ ...v, fecha_inicio: e.target.value }))
                }
                title="Inicio"
              />
              <MedicacionExtrasFields
                fieldClass={fieldClass}
                horarios={tratamientoForm.horarios}
                onHorariosChange={(horarios) =>
                  setTratamientoForm((v) => ({ ...v, horarios }))
                }
                dePorVida={tratamientoForm.de_por_vida}
                onDePorVidaChange={(de_por_vida) =>
                  setTratamientoForm((v) => ({
                    ...v,
                    de_por_vida,
                    fecha_fin: de_por_vida ? "" : v.fecha_fin,
                  }))
                }
                fechaFin={tratamientoForm.fecha_fin}
                onFechaFinChange={(fecha_fin) =>
                  setTratamientoForm((v) => ({ ...v, fecha_fin }))
                }
                fechaFinLabel="Fecha de finalización"
              />
              <button type="submit" className={primaryBtnClass} disabled={busyFicha}>
                Guardar tratamiento
              </button>
            </form>
          }
        />
      </div>
    </div>
  );
}

function FichaColocacionCard({
  title,
  items,
  selected,
  onSelect,
  optionLabel,
  renderDetalle,
  form,
  emptyLabel,
}) {
  const selectedItem =
    selected !== FICHA_NUEVO
      ? items.find((item) => String(item.id) === String(selected)) || null
      : null;
  const mostrandoNuevo = selected === FICHA_NUEVO || items.length === 0;

  return (
    <div className={`${cardClass} space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-aguara-ink">{title}</h3>
        {items.length > 0 ? (
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
            {items.length} previa{items.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-stone-500">{emptyLabel}</p>
      ) : items.length === 1 ? (
        <div className="space-y-2">
          {!mostrandoNuevo ? (
            <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2">
              {renderDetalle(items[0])}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {mostrandoNuevo ? (
              <button
                type="button"
                className={secondaryBtnClass}
                onClick={() => onSelect(String(items[0].id))}
              >
                Ver previa
              </button>
            ) : (
              <button
                type="button"
                className={secondaryBtnClass}
                onClick={() => onSelect(FICHA_NUEVO)}
              >
                Agregar nueva
              </button>
            )}
          </div>
        </div>
      ) : (
        <label className="block text-xs text-stone-500">
          Colocaciones previas
          <select
            className={`${fieldClass} mt-1`}
            value={selected}
            onChange={(e) => onSelect(e.target.value)}
          >
            {items.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {optionLabel(item)}
              </option>
            ))}
            <option value={FICHA_NUEVO}>＋ Agregar nueva…</option>
          </select>
        </label>
      )}

      {items.length > 1 && selectedItem ? (
        <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2">
          {renderDetalle(selectedItem)}
        </div>
      ) : null}

      {mostrandoNuevo ? form : null}
    </div>
  );
}
