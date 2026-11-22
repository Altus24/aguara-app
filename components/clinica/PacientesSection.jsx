"use client";

import { useEffect, useRef, useState } from "react";

import CitaForm from "@/components/clinica/CitaForm";
import { ConsultaForm, DetalleConsulta } from "@/components/clinica/HistoriasSection";
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
  EMPTY_PET_FORM,
  validateMascotaRegistroForm,
} from "@/components/mascotas/MascotaRegistroFields";
import {
  actualizarArchivo,
  actualizarDesparasitacion,
  actualizarVacuna,
  consultaPendienteCompletar,
  crearArchivo,
  crearCliente,
  crearDesparasitacion,
  crearPaciente,
  crearVacuna,
  eliminarArchivo,
  eliminarDesparasitacion,
  eliminarVacuna,
  listarArchivosPacienteCompletas,
  listarClientes,
  listarConsultas,
  listarDesparasitacionesPacienteCompletas,
  listarPacientes,
  listarVacunasPacienteCompletas,
  listarVeterinarios,
  obtenerPaciente,
} from "@/lib/chapitas/clinicaOps";
import { listarServiciosActivos } from "@/lib/chapitas/clinicas";
import { supabase } from "@/lib/chapitas/supabaseClient";
import { esVacunaVencida } from "@/lib/chapitas/vacunas";
import { confirmGuardar } from "@/lib/confirmAction";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  const [form, setForm] = useState({
    cliente_id: "",
    chapita_codigo: "",
    nuevo_cliente_nombre: "",
    nuevo_cliente_email: "",
    nuevo_cliente_telefono: "",
    nuevo_cliente_telefono_secundario: "",
    nuevo_cliente_direccion: "",
    ...EMPTY_PET_FORM,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [crearDueño, setCrearDueño] = useState(false);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);

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
        clinica_cabecera_id: form.clinica_cabecera_id || null,
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
      />

      <Field label="Código chapita (opcional)" id="np-chapita">
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
  const [vets, setVets] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCitaForm, setShowCitaForm] = useState(false);
  const [showHcForm, setShowHcForm] = useState(false);
  const [selectedConsultaId, setSelectedConsultaId] = useState(null);
  const [citaMsg, setCitaMsg] = useState("");

  async function reloadFicha() {
    const p = await obtenerPaciente(pacienteId);
    const [c, v, d, a, vetsRows, serviciosRows, clientesRows] = await Promise.all([
      listarConsultas(clinicaId, { pacienteId }),
      listarVacunasPacienteCompletas(p, { clinicaId }),
      listarDesparasitacionesPacienteCompletas(p, { clinicaId }),
      listarArchivosPacienteCompletas(p, { clinicaId }),
      listarVeterinarios(clinicaId),
      listarServiciosActivos(clinicaId),
      listarClientes(clinicaId),
    ]);
    setPaciente(p);
    setConsultas(c);
    setVacunas(v);
    setDesparas(d);
    setArchivos(a);
    setVets((vetsRows || []).filter((vet) => vet.activo !== false));
    setServicios(serviciosRows || []);
    setClientes(clientesRows || []);
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
          Incluye historias de otras clínicas con la misma chapita (solo lectura).
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

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={cardClass}>
          <h3 className="font-semibold text-aguara-ink">Vacunas</h3>
          {vacunas.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Sin vacunas.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {vacunas.map((v) => (
                <li key={v.id}>
                  <strong>{v.nombre}</strong> · {formatDate(v.fecha)}
                  {esVacunaVencida(v) ? (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">
                      Vencida
                    </span>
                  ) : null}
                  {v.proxima_fecha ? ` · próxima ${formatDate(v.proxima_fecha)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={cardClass}>
          <h3 className="font-semibold text-aguara-ink">Desparasitaciones</h3>
          {desparas.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Sin registros.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {desparas.map((d) => (
                <li key={d.id}>
                  <strong>{d.producto}</strong> · {formatDate(d.fecha)}
                  {d.proxima_fecha ? ` · próxima ${formatDate(d.proxima_fecha)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Archivos</h3>
        {archivos.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Sin archivos.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {archivos.map((a) => (
              <li key={a.id}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-aguara-orange hover:underline"
                >
                  {a.nombre}
                </a>{" "}
                <span className="text-stone-500">
                  ({a.tipo}) · {formatDateTime(a.creado_en)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
