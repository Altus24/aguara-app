"use client";

import { useEffect, useState } from "react";

import CitaForm from "@/components/clinica/CitaForm";
import { ConsultaForm } from "@/components/clinica/HistoriasSection";
import { FichaPaciente } from "@/components/clinica/PacientesSection";
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
import {
  asociarMascotaExistenteACliente,
  buscarMascotaPorIdentificador,
  crearCliente,
  crearPaciente,
  crearPago,
  listarClientes,
  listarConsultas,
  listarPacientes,
  listarPacientesDeCliente,
  listarPagos,
  listarSolicitudesPerfilClinica,
  listarVeterinarios,
  money,
  obtenerCliente,
  proponerOActualizarDatosTutor,
} from "@/lib/chapitas/clinicaOps";
import { listarServiciosActivos } from "@/lib/chapitas/clinicas";
import { confirmGuardar } from "@/lib/confirmAction";

export default function ClientesSection({ clinicaId, clinicaNombre }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function reload(search = q) {
    setLoading(true);
    setError("");
    try {
      setItems(await listarClientes(clinicaId, search));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar clientes.");
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
      <FichaCliente
        clinicaId={clinicaId}
        clinicaNombre={clinicaNombre}
        clienteId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-aguara-ink">Clientes (dueños)</h2>
          <p className="text-sm text-stone-500">Contacto, mascotas y pagos</p>
        </div>
        <button type="button" className={primaryBtnClass} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cerrar" : "Nuevo cliente"}
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono"
          className={fieldClass}
        />
        <button type="button" className={secondaryBtnClass} onClick={() => reload(q)}>
          Buscar
        </button>
      </div>

      {showForm ? (
        <NuevoClienteForm
          clinicaId={clinicaId}
          clinicaNombre={clinicaNombre}
          onCreated={async () => {
            setShowForm(false);
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
        {loading ? (
          <p className="text-sm text-stone-500">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-stone-500">Todavía no hay clientes.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {items.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-stone-50"
                >
                  <div>
                    <p className="font-medium text-aguara-ink">{c.nombre_completo}</p>
                    <p className="text-sm text-stone-500">
                      {c.telefono || "Sin teléfono"}
                      {c.email ? ` · ${c.email}` : ""}
                    </p>
                  </div>
                  <span className="text-sm text-aguara-orange">Ver</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NuevoClienteForm({ clinicaId, clinicaNombre, onCreated }) {
  const [form, setForm] = useState({
    nombre_completo: "",
    email: "",
    telefono: "",
    telefono_secundario: "",
    direccion: "",
    notas: "",
  });
  const [mascotaModo, setMascotaModo] = useState("crear"); // ninguna | crear | asociar
  const [petForm, setPetForm] = useState(() => emptyPetFormConCabecera(clinicaId));
  const [codigoIdentificador, setCodigoIdentificador] = useState("");
  const [mascotaPreview, setMascotaPreview] = useState(null);
  const [pacienteExistenteId, setPacienteExistenteId] = useState("");
  const [pacientesClinica, setPacientesClinica] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const clinicasCabecera = useClinicaCabeceraOptions(clinicaId);

  useEffect(() => {
    setPetForm((f) =>
      f.clinica_cabecera_id === clinicaId ? f : { ...f, clinica_cabecera_id: clinicaId || "" },
    );
  }, [clinicaId]);

  useEffect(() => {
    if (mascotaModo !== "asociar") return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await listarPacientes(clinicaId);
        if (!cancelled) setPacientesClinica(rows || []);
      } catch {
        if (!cancelled) setPacientesClinica([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mascotaModo, clinicaId]);

  async function handleBuscarIdentificador() {
    setError("");
    setMascotaPreview(null);
    setPacienteExistenteId("");
    if (!codigoIdentificador.trim()) {
      setError("Ingresá el código del identificador.");
      return;
    }
    setBuscando(true);
    try {
      const m = await buscarMascotaPorIdentificador(codigoIdentificador);
      if (!m) throw new Error("No se encontró una mascota con ese identificador.");
      setMascotaPreview(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo buscar la mascota.");
    } finally {
      setBuscando(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!form.email.trim()) {
      setError("El email es obligatorio para que el dueño figure en Tutores Aguará.");
      return;
    }
    if (mascotaModo === "crear") {
      const invalid = validateMascotaRegistroForm(petForm);
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    if (mascotaModo === "asociar") {
      if (!pacienteExistenteId && !mascotaPreview?.id && !codigoIdentificador.trim()) {
        setError("Buscá un identificador o elegí una mascota ya cargada en la clínica.");
        return;
      }
    }

    const confirmLabel =
      mascotaModo === "crear"
        ? `el cliente “${form.nombre_completo.trim()}” y la mascota “${petForm.nombre_mascota.trim()}”`
        : mascotaModo === "asociar"
          ? `el cliente “${form.nombre_completo.trim()}” y la asociación de mascota`
          : `el cliente “${form.nombre_completo.trim()}”`;
    if (!(await confirmGuardar(confirmLabel))) return;

    setSaving(true);
    try {
      const cliente = await crearCliente(clinicaId, form);
      if (mascotaModo === "crear") {
        await crearPaciente(clinicaId, {
          cliente_id: cliente.id,
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
      } else if (mascotaModo === "asociar") {
        await asociarMascotaExistenteACliente(clinicaId, cliente.id, {
          pacienteId: pacienteExistenteId || null,
          codigo: pacienteExistenteId ? null : mascotaPreview?.id || codigoIdentificador,
        });
      }
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-4`}>
      <h3 className="font-semibold text-aguara-ink">Nuevo cliente</h3>
      <p className="text-xs text-stone-500">
        Con email y teléfono también se crea/vincula el tutor Aguará y aparece en el buscador de
        Tutores.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre completo" id="cli-nom">
          <input
            id="cli-nom"
            required
            className={fieldClass}
            value={form.nombre_completo}
            onChange={(e) => setForm((f) => ({ ...f, nombre_completo: e.target.value }))}
          />
        </Field>
        <Field label="Teléfono" id="cli-tel">
          <input
            id="cli-tel"
            required
            className={fieldClass}
            value={form.telefono}
            onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
          />
        </Field>
        <Field label="Email *" id="cli-email">
          <input
            id="cli-email"
            type="email"
            required
            className={fieldClass}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </Field>
        <Field label="Tel. secundario" id="cli-tel2">
          <input
            id="cli-tel2"
            className={fieldClass}
            value={form.telefono_secundario}
            onChange={(e) => setForm((f) => ({ ...f, telefono_secundario: e.target.value }))}
          />
        </Field>
        <Field label="Dirección" id="cli-dir" className="sm:col-span-2">
          <input
            id="cli-dir"
            className={fieldClass}
            value={form.direccion}
            onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
          />
        </Field>
      </div>

      <div className="space-y-3 border-t border-stone-100 pt-4">
        <p className="text-sm font-semibold text-aguara-ink">Mascota</p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "crear", label: "Crear mascota nueva" },
            { id: "asociar", label: "Asociar mascota existente" },
            { id: "ninguna", label: "Sin mascota por ahora" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                mascotaModo === opt.id
                  ? "border-aguara-orange bg-aguara-cream/50 text-aguara-ink"
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
              }`}
              onClick={() => {
                setMascotaModo(opt.id);
                setError("");
                setMascotaPreview(null);
                setPacienteExistenteId("");
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {mascotaModo === "crear" ? (
          <MascotaRegistroFields
            form={petForm}
            onChange={(name, value) => setPetForm((f) => ({ ...f, [name]: value }))}
            fieldClass={fieldClass}
            fotoInputId="nuevo-cli-mascota"
            showTitle={false}
            clinicas={clinicasCabecera}
          />
        ) : null}

        {mascotaModo === "asociar" ? (
          <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
            <Field label="Código de identificador Aguará" id="cli-asoc-codigo">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="cli-asoc-codigo"
                  className={fieldClass}
                  placeholder="Ej. T1-001 o DIG-…"
                  value={codigoIdentificador}
                  onChange={(e) => {
                    setCodigoIdentificador(e.target.value);
                    setMascotaPreview(null);
                  }}
                />
                <button
                  type="button"
                  className={secondaryBtnClass}
                  disabled={buscando}
                  onClick={handleBuscarIdentificador}
                >
                  {buscando ? "Buscando…" : "Buscar"}
                </button>
              </div>
            </Field>
            {mascotaPreview ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Encontrada: <strong>{mascotaPreview.nombre_mascota}</strong>
                {mascotaPreview.especie ? ` · ${mascotaPreview.especie}` : ""}
                {mascotaPreview.raza ? ` · ${mascotaPreview.raza}` : ""}
                <span className="mt-0.5 block text-xs text-emerald-800/80">
                  ID {mascotaPreview.id}
                </span>
              </p>
            ) : null}

            <Field label="O elegir mascota ya cargada en esta clínica" id="cli-asoc-pac">
              <select
                id="cli-asoc-pac"
                className={fieldClass}
                value={pacienteExistenteId}
                onChange={(e) => {
                  setPacienteExistenteId(e.target.value);
                  if (e.target.value) {
                    setMascotaPreview(null);
                    setCodigoIdentificador("");
                  }
                }}
              >
                <option value="">— Ninguna —</option>
                {pacientesClinica.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {p.especie ? ` · ${p.especie}` : ""}
                    {p.clinica_clientes?.nombre_completo
                      ? ` (dueño actual: ${p.clinica_clientes.nombre_completo})`
                      : ""}
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-xs text-stone-500">
              Si elegís una mascota de la clínica, pasa a este cliente. Si usás el identificador,
              se importa o vincula la ficha Aguará.
            </p>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={saving} className={primaryBtnClass}>
        {saving
          ? "Guardando…"
          : mascotaModo === "ninguna"
            ? "Guardar cliente"
            : "Guardar cliente y mascota"}
      </button>
    </form>
  );
}

function NuevaMascotaEnClienteForm({
  clinicaId,
  clinicaNombre,
  clienteId,
  clienteNombre,
  onCreated,
  onCancel,
}) {
  const [petForm, setPetForm] = useState(() => emptyPetFormConCabecera(clinicaId));
  const [chapitaCodigo, setChapitaCodigo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const clinicasCabecera = useClinicaCabeceraOptions(clinicaId);

  useEffect(() => {
    setPetForm((f) =>
      f.clinica_cabecera_id === clinicaId ? f : { ...f, clinica_cabecera_id: clinicaId || "" },
    );
  }, [clinicaId]);

  async function handleSubmit(event) {
    event.preventDefault();
    const invalid = validateMascotaRegistroForm(petForm);
    if (invalid) {
      setError(invalid);
      return;
    }
    const nombre = petForm.nombre_mascota.trim();
    const confirmLabel = clienteNombre
      ? `la mascota “${nombre}” para “${clienteNombre}”`
      : `la mascota “${nombre}”`;
    if (!(await confirmGuardar(confirmLabel))) return;

    setSaving(true);
    setError("");
    try {
      await crearPaciente(clinicaId, {
        cliente_id: clienteId,
        nombre,
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
        chapita_codigo: chapitaCodigo.trim() || null,
        clinica_cabecera_id: petForm.clinica_cabecera_id || clinicaId,
        clinica_ref_nombre: petForm.clinica_ref_nombre,
        clinica_ref_direccion: petForm.clinica_ref_direccion,
        clinica_ref_telefono: petForm.clinica_ref_telefono,
      });
      await onCreated(nombre);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la mascota.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm font-medium text-aguara-ink">Nueva mascota</p>
      <MascotaRegistroFields
        form={petForm}
        onChange={(name, value) => setPetForm((f) => ({ ...f, [name]: value }))}
        fieldClass={fieldClass}
        fotoInputId="ficha-cli-foto"
        clinicas={clinicasCabecera}
      />
      <Field label="Código identificador (opcional)" id="ficha-cli-chapita">
        <input
          id="ficha-cli-chapita"
          className={fieldClass}
          placeholder="Ej. T1-004 — dejar vacío si aún no tiene"
          value={chapitaCodigo}
          onChange={(e) => setChapitaCodigo(e.target.value)}
        />
      </Field>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className={primaryBtnClass}>
          {saving ? "Guardando…" : "Guardar mascota"}
        </button>
        {onCancel ? (
          <button type="button" className={secondaryBtnClass} onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}

function FichaCliente({ clinicaId, clinicaNombre, clienteId, onBack }) {
  const [cliente, setCliente] = useState(null);
  const [mascotas, setMascotas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [vets, setVets] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [showCitaForm, setShowCitaForm] = useState(false);
  const [showConsultaForm, setShowConsultaForm] = useState(false);
  const [showMascotaForm, setShowMascotaForm] = useState(false);
  const [perfilMascotaId, setPerfilMascotaId] = useState(null);
  const [form, setForm] = useState({
    nombre_completo: "",
    email: "",
    telefono: "",
    telefono_secundario: "",
    direccion: "",
    notas: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [pagoForm, setPagoForm] = useState({
    monto: "",
    concepto: "Consulta",
    metodo: "efectivo",
    paciente_id: "",
  });
  const [savingPago, setSavingPago] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [c, m, p, sols, vetsRows, serviciosRows] = await Promise.all([
        obtenerCliente(clienteId),
        listarPacientesDeCliente(clienteId),
        listarPagos(clinicaId, { clienteId }),
        listarSolicitudesPerfilClinica(clinicaId, { soloPendientes: true }),
        listarVeterinarios(clinicaId),
        listarServiciosActivos(clinicaId),
      ]);
      setCliente(c);
      setMascotas(m);
      setPagos(p);
      setPendientes((sols || []).filter((s) => s.cliente_id === clienteId));
      setVets((vetsRows || []).filter((vet) => vet.activo !== false));
      setServicios(serviciosRows || []);
      setForm({
        nombre_completo: c.nombre_completo || "",
        email: c.email || "",
        telefono: c.telefono || "",
        telefono_secundario: c.telefono_secundario || "",
        direccion: c.direccion || "",
        notas: c.notas || "",
      });
      const allConsultas = await Promise.all(
        m.map((mascota) => listarConsultas(clinicaId, { pacienteId: mascota.id })),
      );
      setVisitas(allConsultas.flat().sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el cliente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId, clienteId]);

  async function handleSavePerfil(event) {
    event.preventDefault();
    if (!(await confirmGuardar("los datos del cliente"))) return;
    setSavingEdit(true);
    setError("");
    setMessage("");
    try {
      const result = await proponerOActualizarDatosTutor({
        clinicaId,
        clinicaNombre,
        clienteId,
        payload: form,
      });
      if (result.modo === "pendiente_tutor") {
        setMessage(
          "Se envió la propuesta al tutor. Los datos se actualizarán cuando acepte la notificación.",
        );
      } else if (result.modo === "inmediato") {
        setMessage("Datos del cliente actualizados.");
      } else {
        setMessage("Sin cambios en el perfil (notas guardadas si correspondía).");
      }
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSavingEdit(false);
    }
  }

  if (perfilMascotaId) {
    return (
      <FichaPaciente
        clinicaId={clinicaId}
        pacienteId={perfilMascotaId}
        onBack={() => {
          setPerfilMascotaId(null);
          load();
        }}
      />
    );
  }

  if (loading) return <p className="text-sm text-stone-500">Cargando cliente…</p>;
  if (!cliente) {
    return error ? <p className="text-sm text-red-700">{error}</p> : null;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={secondaryBtnClass} onClick={onBack}>
          ← Volver
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryBtnClass}
            onClick={() => {
              setShowConsultaForm(false);
              setShowMascotaForm(false);
              setShowCitaForm((v) => !v);
              setMessage("");
              setError("");
            }}
          >
            {showCitaForm ? "Cerrar cita" : "Nueva cita"}
          </button>
          <button
            type="button"
            className={primaryBtnClass}
            onClick={() => {
              setShowCitaForm(false);
              setShowMascotaForm(false);
              setShowConsultaForm((v) => !v);
              setMessage("");
              setError("");
            }}
          >
            {showConsultaForm ? "Cerrar consulta" : "Nueva consulta"}
          </button>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-aguara-ink">{cliente.nombre_completo}</h2>
            <p className="mt-2 text-sm text-stone-600">
              {cliente.telefono}
              {cliente.telefono_secundario ? ` · ${cliente.telefono_secundario}` : ""}
            </p>
            {cliente.email ? <p className="text-sm text-stone-600">{cliente.email}</p> : null}
            {cliente.direccion ? (
              <p className="mt-1 text-sm text-stone-500">{cliente.direccion}</p>
            ) : null}
            {cliente.tutor_id ? (
              <p className="mt-2 text-xs font-medium text-emerald-700">
                Vinculado a cuenta tutor Aguará
              </p>
            ) : (
              <p className="mt-2 text-xs text-stone-500">
                Sin cuenta tutor: los cambios se aplican solo en la clínica.
              </p>
            )}
          </div>
          <button
            type="button"
            className={secondaryBtnClass}
            onClick={() => {
              setEditing((v) => !v);
              setMessage("");
              setError("");
            }}
          >
            {editing ? "Cancelar edición" : "Editar datos"}
          </button>
        </div>

        {pendientes.length > 0 ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Hay {pendientes.length} cambio{pendientes.length === 1 ? "" : "s"} esperando aceptación
            del tutor.
          </p>
        ) : null}

        {editing ? (
          <form onSubmit={handleSavePerfil} className="mt-4 space-y-3 border-t border-stone-100 pt-4">
            <p className="text-sm text-stone-500">
              Si el tutor tiene cuenta Aguará, deberá aceptar el cambio antes de que se aplique a su
              perfil.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre completo" id="edit-nom">
                <input
                  id="edit-nom"
                  required
                  className={fieldClass}
                  value={form.nombre_completo}
                  onChange={(e) => setForm((f) => ({ ...f, nombre_completo: e.target.value }))}
                />
              </Field>
              <Field label="Teléfono" id="edit-tel">
                <input
                  id="edit-tel"
                  required
                  className={fieldClass}
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                />
              </Field>
              <Field label="Email" id="edit-email">
                <input
                  id="edit-email"
                  type="email"
                  className={`${fieldClass} bg-stone-50 text-stone-500`}
                  value={form.email}
                  disabled
                  title="El email es el acceso del tutor y no se modifica desde acá"
                />
              </Field>
              <Field label="Tel. secundario" id="edit-tel2">
                <input
                  id="edit-tel2"
                  className={fieldClass}
                  value={form.telefono_secundario}
                  onChange={(e) => setForm((f) => ({ ...f, telefono_secundario: e.target.value }))}
                />
              </Field>
              <Field label="Dirección" id="edit-dir" className="sm:col-span-2">
                <input
                  id="edit-dir"
                  className={fieldClass}
                  value={form.direccion}
                  onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                />
              </Field>
              <Field label="Notas internas (solo clínica)" id="edit-notas" className="sm:col-span-2">
                <textarea
                  id="edit-notas"
                  rows={2}
                  className={fieldClass}
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                />
              </Field>
            </div>
            <button type="submit" disabled={savingEdit} className={primaryBtnClass}>
              {savingEdit
                ? "Guardando…"
                : cliente.tutor_id
                  ? "Enviar propuesta al tutor"
                  : "Guardar datos"}
            </button>
          </form>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      </div>

      {showCitaForm ? (
        <CitaForm
          clinicaId={clinicaId}
          pacientes={mascotas}
          clientes={[cliente]}
          vets={vets}
          servicios={servicios}
          omitirPendiente
          initial={{
            cliente_id: clienteId,
            estado: "confirmada",
          }}
          defaultDay={new Date()}
          onCancel={() => setShowCitaForm(false)}
          onPacientesChange={setMascotas}
          onSaved={async () => {
            setShowCitaForm(false);
            setMessage("Cita creada y confirmada.");
            await load();
          }}
        />
      ) : null}

      {showConsultaForm ? (
        <ConsultaForm
          clinicaId={clinicaId}
          pacientes={mascotas}
          clientes={[cliente]}
          vets={vets}
          initial={{
            cliente_id: clienteId,
          }}
          onCancel={() => setShowConsultaForm(false)}
          onPacientesChange={setMascotas}
          onSaved={async () => {
            setShowConsultaForm(false);
            setMessage("Consulta / historia clínica creada.");
            await load();
          }}
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-aguara-ink">Mascotas asociadas</h3>
            <button
              type="button"
              className={secondaryBtnClass}
              onClick={() => {
                setShowCitaForm(false);
                setShowConsultaForm(false);
                setShowMascotaForm((v) => !v);
                setMessage("");
                setError("");
              }}
            >
              {showMascotaForm ? "Cerrar" : "Agregar mascota"}
            </button>
          </div>
          {mascotas.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Sin mascotas.</p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {mascotas.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <strong>{m.nombre}</strong> · {m.especie}
                    {m.raza ? ` · ${m.raza}` : ""}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-sm font-medium text-aguara-orange hover:underline"
                    onClick={() => {
                      setShowMascotaForm(false);
                      setShowCitaForm(false);
                      setShowConsultaForm(false);
                      setPerfilMascotaId(m.id);
                    }}
                  >
                    Ver perfil
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showMascotaForm ? (
            <div className="mt-4 border-t border-stone-100 pt-4">
              <NuevaMascotaEnClienteForm
                clinicaId={clinicaId}
                clinicaNombre={clinicaNombre}
                clienteId={clienteId}
                clienteNombre={cliente.nombre_completo}
                onCancel={() => setShowMascotaForm(false)}
                onCreated={async (mascotaNombre) => {
                  setShowMascotaForm(false);
                  setMessage(
                    mascotaNombre
                      ? `Mascota “${mascotaNombre}” agregada al cliente.`
                      : "Mascota agregada al cliente.",
                  );
                  await load();
                }}
              />
            </div>
          ) : null}
        </div>

        <div className={cardClass}>
          <h3 className="font-semibold text-aguara-ink">Historial de visitas</h3>
          {visitas.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Sin visitas registradas.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {visitas.map((v) => (
                <li key={v.id}>
                  {formatDateTime(v.fecha)} · {v.clinica_pacientes?.nombre} ·{" "}
                  {v.motivo || "Consulta"}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Pagos (vista rápida)</h3>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!(await confirmGuardar("el pago"))) return;
            setSavingPago(true);
            try {
              await crearPago(clinicaId, {
                cliente_id: clienteId,
                paciente_id: pagoForm.paciente_id || null,
                monto: pagoForm.monto,
                concepto: pagoForm.concepto,
                metodo: pagoForm.metodo,
              });
              setPagoForm({ monto: "", concepto: "Consulta", metodo: "efectivo", paciente_id: "" });
              await load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "No se pudo registrar el pago.");
            } finally {
              setSavingPago(false);
            }
          }}
        >
          <input
            required
            type="number"
            min="0"
            step="0.01"
            placeholder="Monto"
            className={fieldClass}
            value={pagoForm.monto}
            onChange={(e) => setPagoForm((f) => ({ ...f, monto: e.target.value }))}
          />
          <input
            placeholder="Concepto"
            className={fieldClass}
            value={pagoForm.concepto}
            onChange={(e) => setPagoForm((f) => ({ ...f, concepto: e.target.value }))}
          />
          <select
            className={fieldClass}
            value={pagoForm.metodo}
            onChange={(e) => setPagoForm((f) => ({ ...f, metodo: e.target.value }))}
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="otro">Otro</option>
          </select>
          <button type="submit" disabled={savingPago} className={primaryBtnClass}>
            {savingPago ? "…" : "Cobrar"}
          </button>
          <select
            className={`${fieldClass} sm:col-span-4`}
            value={pagoForm.paciente_id}
            onChange={(e) => setPagoForm((f) => ({ ...f, paciente_id: e.target.value }))}
          >
            <option value="">Mascota (opcional)</option>
            {mascotas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </form>

        {pagos.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">Sin pagos.</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-100">
            {pagos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {formatDate(p.fecha)} · {p.concepto} · {p.metodo}
                </span>
                <strong>{money(p.monto)}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
