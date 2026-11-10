"use client";

import { useEffect, useState } from "react";

import {
  cardClass,
  Field,
  fieldClass,
  formatDate,
  formatDateTime,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/clinica/ui";
import {
  actualizarArchivo,
  actualizarConsulta,
  actualizarDesparasitacion,
  actualizarVacuna,
  crearArchivo,
  crearCliente,
  crearConsulta,
  crearDesparasitacion,
  crearPaciente,
  crearVacuna,
  eliminarArchivo,
  eliminarDesparasitacion,
  eliminarVacuna,
  listarArchivos,
  listarClientes,
  listarConsultas,
  listarDesparasitaciones,
  listarPacientes,
  listarVacunasPacienteCompletas,
  listarVeterinarios,
  obtenerPaciente,
} from "@/lib/chapitas/clinicaOps";

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
                      {p.raza ? ` · ${p.raza}` : ""} · Tutores:{" "}
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
    nombre: "",
    especie: "Canino",
    raza: "",
    sexo: "",
    peso: "",
    chip: "",
    alergias: "",
    nuevo_cliente_nombre: "",
    nuevo_cliente_telefono: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [crearTutor, setcrearTutor] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      let clienteId = form.cliente_id;
      if (crearTutor) {
        const cliente = await crearCliente(clinicaId, {
          nombre_completo: form.nuevo_cliente_nombre,
          telefono: form.nuevo_cliente_telefono,
        });
        clienteId = cliente.id;
        await onClientCreated();
      }
      if (!clienteId) throw new Error("Seleccioná o creá un tutor.");
      await crearPaciente(clinicaId, { ...form, cliente_id: clienteId });
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-3`}>
      <h3 className="font-semibold text-aguara-ink">Nueva mascota</h3>
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          checked={crearTutor}
          onChange={(e) => setcrearTutor(e.target.checked)}
        />
        Crear tutor nuevo
      </label>
      {crearTutor ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre del tutor" id="np-dueno">
            <input
              id="np-dueno"
              required
              className={fieldClass}
              value={form.nuevo_cliente_nombre}
              onChange={(e) => setForm((f) => ({ ...f, nuevo_cliente_nombre: e.target.value }))}
            />
          </Field>
          <Field label="Teléfono" id="np-tel">
            <input
              id="np-tel"
              required
              className={fieldClass}
              value={form.nuevo_cliente_telefono}
              onChange={(e) => setForm((f) => ({ ...f, nuevo_cliente_telefono: e.target.value }))}
            />
          </Field>
        </div>
      ) : (
        <Field label="Tutor" id="np-cliente">
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
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" id="np-nombre">
          <input
            id="np-nombre"
            required
            className={fieldClass}
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          />
        </Field>
        <Field label="Especie" id="np-especie">
          <input
            id="np-especie"
            className={fieldClass}
            value={form.especie}
            onChange={(e) => setForm((f) => ({ ...f, especie: e.target.value }))}
          />
        </Field>
        <Field label="Raza" id="np-raza">
          <input
            id="np-raza"
            className={fieldClass}
            value={form.raza}
            onChange={(e) => setForm((f) => ({ ...f, raza: e.target.value }))}
          />
        </Field>
        <Field label="Sexo" id="np-sexo">
          <select
            id="np-sexo"
            className={fieldClass}
            value={form.sexo}
            onChange={(e) => setForm((f) => ({ ...f, sexo: e.target.value }))}
          >
            <option value="">—</option>
            <option value="Macho">Macho</option>
            <option value="Hembra">Hembra</option>
          </select>
        </Field>
        <Field label="Peso (kg)" id="np-peso">
          <input
            id="np-peso"
            type="number"
            step="0.1"
            className={fieldClass}
            value={form.peso}
            onChange={(e) => setForm((f) => ({ ...f, peso: e.target.value }))}
          />
        </Field>
        <Field label="Chip" id="np-chip">
          <input
            id="np-chip"
            className={fieldClass}
            value={form.chip}
            onChange={(e) => setForm((f) => ({ ...f, chip: e.target.value }))}
          />
        </Field>
      </div>
      <Field label="Alergias" id="np-alergias">
        <input
          id="np-alergias"
          className={fieldClass}
          value={form.alergias}
          onChange={(e) => setForm((f) => ({ ...f, alergias: e.target.value }))}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showConsultaForm, setShowConsultaForm] = useState(false);
  const [editingConsulta, setEditingConsulta] = useState(null);
  const [verConsulta, setVerConsulta] = useState(null);
  const [editingVacuna, setEditingVacuna] = useState(null);
  const [editingDespara, setEditingDespara] = useState(null);
  const [editingArchivo, setEditingArchivo] = useState(null);
  const [showVacunaForm, setShowVacunaForm] = useState(false);
  const [showDesparaForm, setShowDesparaForm] = useState(false);
  const [showArchivoForm, setShowArchivoForm] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [p, c, d, a, veterinarios] = await Promise.all([
        obtenerPaciente(pacienteId),
        listarConsultas(clinicaId, { pacienteId }),
        listarDesparasitaciones(pacienteId),
        listarArchivos(pacienteId),
        listarVeterinarios(clinicaId),
      ]);
      const v = await listarVacunasPacienteCompletas(p);
      setPaciente(p);
      setConsultas(c);
      setVacunas(v);
      setDesparas(d);
      setArchivos(a);
      setVets(veterinarios.filter((x) => x.activo !== false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar ficha.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId, pacienteId]);

  if (loading) return <p className="text-sm text-stone-500">Cargando ficha…</p>;
  if (error && !paciente) return <p className="text-sm text-red-700">{error}</p>;
  if (!paciente) return null;

  return (
    <div className="space-y-5">
      <button type="button" className={secondaryBtnClass} onClick={onBack}>
        ← Volver al listado
      </button>

      <div className={cardClass}>
        <h2 className="text-2xl font-semibold text-aguara-ink">{paciente.nombre}</h2>
        <p className="mt-1 text-sm text-stone-600">
          {paciente.especie}
          {paciente.raza ? ` · ${paciente.raza}` : ""}
          {paciente.sexo ? ` · ${paciente.sexo}` : ""}
          {paciente.peso ? ` · ${paciente.peso} kg` : ""}
        </p>
        <p className="mt-3 text-sm text-stone-700">
          Tutor: <strong>{paciente.clinica_clientes?.nombre_completo}</strong>
          {paciente.clinica_clientes?.telefono
            ? ` · ${paciente.clinica_clientes.telefono}`
            : ""}
        </p>
        {paciente.alergias ? (
          <p className="mt-2 text-sm text-amber-800">Alergias: {paciente.alergias}</p>
        ) : null}
        {paciente.chip ? <p className="mt-1 text-sm text-stone-500">Chip: {paciente.chip}</p> : null}
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <div className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-aguara-ink">Historia clínica</h3>
          <button
            type="button"
            className={primaryBtnClass}
            onClick={() => {
              setEditingConsulta(null);
              setShowConsultaForm((v) => !v);
            }}
          >
            {showConsultaForm && !editingConsulta ? "Cerrar" : "Nueva consulta"}
          </button>
        </div>

        {showConsultaForm || editingConsulta ? (
          <ConsultaFichaForm
            clinicaId={clinicaId}
            paciente={paciente}
            vets={vets}
            initial={editingConsulta}
            onCancel={() => {
              setShowConsultaForm(false);
              setEditingConsulta(null);
            }}
            onSaved={async () => {
              setShowConsultaForm(false);
              setEditingConsulta(null);
              setMessage("Historia clínica guardada.");
              await load();
            }}
          />
        ) : null}

        {verConsulta ? (
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-aguara-orange">Vista completa</p>
                <p className="font-semibold text-aguara-ink">
                  {formatDateTime(verConsulta.fecha)}
                  {verConsulta.cerrada ? " · Cerrada" : " · Abierta"}
                </p>
              </div>
              <button
                type="button"
                className={secondaryBtnClass}
                onClick={() => setVerConsulta(null)}
              >
                Cerrar vista
              </button>
            </div>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <VistaItem label="Motivo" value={verConsulta.motivo} />
              <VistaItem
                label="Veterinario"
                value={verConsulta.clinica_veterinarios?.nombre}
              />
              <VistaItem label="Anamnesis" value={verConsulta.anamnesis} wide />
              <VistaItem label="Examen físico" value={verConsulta.examen_fisico} wide />
              <VistaItem label="Diagnóstico" value={verConsulta.diagnostico} wide />
              <VistaItem label="Tratamiento" value={verConsulta.tratamiento} />
              <VistaItem label="Medicación" value={verConsulta.medicacion} />
              <VistaItem
                label="Peso"
                value={verConsulta.peso != null ? `${verConsulta.peso} kg` : null}
              />
              <VistaItem
                label="Temperatura"
                value={
                  verConsulta.temperatura != null ? `${verConsulta.temperatura} °C` : null
                }
              />
              <VistaItem label="Observaciones" value={verConsulta.observaciones} wide />
              <VistaItem
                label="Última modificación"
                value={formatDateTime(
                  verConsulta.actualizado_en ||
                    verConsulta.cerrado_en ||
                    verConsulta.creado_en ||
                    verConsulta.fecha,
                )}
                wide
              />
            </dl>
            {verConsulta.cerrada ? (
              <p className="mt-3 text-sm text-emerald-800">
                Firmado por {verConsulta.firmado_por || "—"}
                {verConsulta.cerrado_en ? ` · ${formatDateTime(verConsulta.cerrado_en)}` : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        {consultas.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Sin consultas registradas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {consultas.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-aguara-ink">
                      {formatDateTime(c.fecha)}
                      {c.cerrada ? " · Cerrada" : " · Abierta"}
                    </p>
                    <p className="text-sm text-stone-600">
                      Motivo: {c.motivo || "Consulta"}
                      {c.clinica_veterinarios?.nombre
                        ? ` · ${c.clinica_veterinarios.nombre}`
                        : ""}
                    </p>
                    {c.diagnostico ? (
                      <p className="mt-1 text-sm text-stone-700">Diagnóstico: {c.diagnostico}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-stone-400">
                      Última modificación:{" "}
                      {formatDateTime(c.actualizado_en || c.cerrado_en || c.creado_en || c.fecha)}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="text-sm text-aguara-orange underline"
                      onClick={() => {
                        setShowConsultaForm(false);
                        setEditingConsulta(null);
                        setVerConsulta(c);
                      }}
                    >
                      Ver
                    </button>
                    {!c.clinica_id || c.clinica_id === clinicaId ? (
                      <button
                        type="button"
                        className="text-sm text-stone-600 underline"
                        onClick={() => {
                          setVerConsulta(null);
                          setShowConsultaForm(false);
                          setEditingConsulta(c);
                        }}
                      >
                        Editar
                      </button>
                    ) : (
                      <span className="text-xs text-stone-400">Otra clínica</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-aguara-ink">Vacunas</h3>
            <button
              type="button"
              className={secondaryBtnClass}
              onClick={() => {
                setEditingVacuna(null);
                setShowVacunaForm((v) => !v);
              }}
            >
              {showVacunaForm && !editingVacuna ? "Cerrar" : "Agregar"}
            </button>
          </div>
          {showVacunaForm || editingVacuna ? (
            <VacunaForm
              clinicaId={clinicaId}
              pacienteId={pacienteId}
              initial={editingVacuna}
              onCancel={() => {
                setShowVacunaForm(false);
                setEditingVacuna(null);
              }}
              onSaved={async () => {
                setShowVacunaForm(false);
                setEditingVacuna(null);
                setMessage("Vacuna guardada.");
                await load();
              }}
            />
          ) : null}
          {vacunas.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Sin vacunas.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {vacunas.map((v) => (
                <li
                  key={`${v.origen || "clinica"}-${v.id}`}
                  className="flex flex-wrap items-start justify-between gap-2"
                >
                  <span>
                    <strong>{v.nombre}</strong> · {formatDate(v.fecha)}
                    {v.proxima_fecha ? ` · próxima ${formatDate(v.proxima_fecha)}` : ""}
                    {v.lote ? ` · lote ${v.lote}` : ""}
                    {v.origen === "tutor" ? (
                      <span className="ml-1 text-xs text-aguara-orange">(cargada por el tutor)</span>
                    ) : null}
                  </span>
                  {v.origen === "tutor" ? (
                    <span className="text-xs text-stone-400">Solo lectura</span>
                  ) : (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        className="text-aguara-orange underline"
                        onClick={() => {
                          setShowVacunaForm(false);
                          setEditingVacuna(v);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="text-stone-500 underline"
                        onClick={async () => {
                          await eliminarVacuna(v.id);
                          setMessage("Vacuna eliminada.");
                          await load();
                        }}
                      >
                        Quitar
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-aguara-ink">Desparasitaciones</h3>
            <button
              type="button"
              className={secondaryBtnClass}
              onClick={() => {
                setEditingDespara(null);
                setShowDesparaForm((v) => !v);
              }}
            >
              {showDesparaForm && !editingDespara ? "Cerrar" : "Agregar"}
            </button>
          </div>
          {showDesparaForm || editingDespara ? (
            <DesparaForm
              clinicaId={clinicaId}
              pacienteId={pacienteId}
              initial={editingDespara}
              onCancel={() => {
                setShowDesparaForm(false);
                setEditingDespara(null);
              }}
              onSaved={async () => {
                setShowDesparaForm(false);
                setEditingDespara(null);
                setMessage("Desparasitación guardada.");
                await load();
              }}
            />
          ) : null}
          {desparas.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Sin registros.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {desparas.map((d) => (
                <li key={d.id} className="flex flex-wrap items-start justify-between gap-2">
                  <span>
                    <strong>{d.producto}</strong> · {formatDate(d.fecha)}
                    {d.proxima_fecha ? ` · próxima ${formatDate(d.proxima_fecha)}` : ""}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className="text-aguara-orange underline"
                      onClick={() => {
                        setShowDesparaForm(false);
                        setEditingDespara(d);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-stone-500 underline"
                      onClick={async () => {
                        await eliminarDesparasitacion(d.id);
                        setMessage("Desparasitación eliminada.");
                        await load();
                      }}
                    >
                      Quitar
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-aguara-ink">Archivos</h3>
          <button
            type="button"
            className={secondaryBtnClass}
            onClick={() => {
              setEditingArchivo(null);
              setShowArchivoForm((v) => !v);
            }}
          >
            {showArchivoForm && !editingArchivo ? "Cerrar" : "Agregar"}
          </button>
        </div>
        {showArchivoForm || editingArchivo ? (
          <ArchivoForm
            clinicaId={clinicaId}
            pacienteId={pacienteId}
            initial={editingArchivo}
            onCancel={() => {
              setShowArchivoForm(false);
              setEditingArchivo(null);
            }}
            onSaved={async () => {
              setShowArchivoForm(false);
              setEditingArchivo(null);
              setMessage("Archivo guardado.");
              await load();
            }}
          />
        ) : null}
        {archivos.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Sin archivos.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {archivos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-2">
                <span>
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
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="text-aguara-orange underline"
                    onClick={() => {
                      setShowArchivoForm(false);
                      setEditingArchivo(a);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="text-stone-500 underline"
                    onClick={async () => {
                      await eliminarArchivo(a.id);
                      setMessage("Archivo eliminado.");
                      await load();
                    }}
                  >
                    Quitar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function VistaItem({ label, value, wide }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-stone-500">{label}</dt>
      <dd className="mt-0.5 text-aguara-ink">{value || "—"}</dd>
    </div>
  );
}

function ConsultaFichaForm({ clinicaId, paciente, vets, initial, onCancel, onSaved }) {
  const [form, setForm] = useState({
    veterinario_id: initial?.veterinario_id || "",
    motivo: initial?.motivo || "",
    anamnesis: initial?.anamnesis || "",
    examen_fisico: initial?.examen_fisico || "",
    diagnostico: initial?.diagnostico || "",
    tratamiento: initial?.tratamiento || "",
    medicacion: initial?.medicacion || "",
    peso: initial?.peso ?? "",
    temperatura: initial?.temperatura ?? "",
    observaciones: initial?.observaciones || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        motivo: form.motivo?.trim() || null,
        anamnesis: form.anamnesis?.trim() || null,
        examen_fisico: form.examen_fisico?.trim() || null,
        diagnostico: form.diagnostico?.trim() || null,
        tratamiento: form.tratamiento?.trim() || null,
        medicacion: form.medicacion?.trim() || null,
        peso: form.peso === "" || form.peso == null ? null : Number(form.peso),
        temperatura:
          form.temperatura === "" || form.temperatura == null ? null : Number(form.temperatura),
        observaciones: form.observaciones?.trim() || null,
        veterinario_id: form.veterinario_id || null,
      };
      if (initial?.id) {
        if (initial.clinica_id && initial.clinica_id !== clinicaId) {
          throw new Error("No podés editar historias clínicas de otra clínica.");
        }
        await actualizarConsulta(initial.id, payload, { clinicaId });
      } else {
        await crearConsulta(clinicaId, {
          ...payload,
          paciente_id: paciente.id,
          cliente_id: paciente.cliente_id || paciente.clinica_clientes?.id || null,
        });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-xl border border-stone-100 p-3">
      <p className="text-sm font-medium text-aguara-ink">
        {initial?.id ? "Editar consulta" : "Nueva consulta"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Veterinario" id="ficha-vet">
          <select
            id="ficha-vet"
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
        <Field label="Motivo" id="ficha-mot">
          <input
            id="ficha-mot"
            className={fieldClass}
            value={form.motivo}
            onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
          />
        </Field>
        <Field label="Anamnesis" id="ficha-ana" className="sm:col-span-2">
          <textarea
            id="ficha-ana"
            rows={2}
            className={fieldClass}
            value={form.anamnesis}
            onChange={(e) => setForm((f) => ({ ...f, anamnesis: e.target.value }))}
          />
        </Field>
        <Field label="Examen físico" id="ficha-ex" className="sm:col-span-2">
          <textarea
            id="ficha-ex"
            rows={2}
            className={fieldClass}
            value={form.examen_fisico}
            onChange={(e) => setForm((f) => ({ ...f, examen_fisico: e.target.value }))}
          />
        </Field>
        <Field label="Diagnóstico" id="ficha-dx" className="sm:col-span-2">
          <textarea
            id="ficha-dx"
            rows={2}
            className={fieldClass}
            value={form.diagnostico}
            onChange={(e) => setForm((f) => ({ ...f, diagnostico: e.target.value }))}
          />
        </Field>
        <Field label="Tratamiento" id="ficha-tx">
          <input
            id="ficha-tx"
            className={fieldClass}
            value={form.tratamiento}
            onChange={(e) => setForm((f) => ({ ...f, tratamiento: e.target.value }))}
          />
        </Field>
        <Field label="Medicación" id="ficha-med">
          <input
            id="ficha-med"
            className={fieldClass}
            value={form.medicacion}
            onChange={(e) => setForm((f) => ({ ...f, medicacion: e.target.value }))}
          />
        </Field>
        <Field label="Peso (kg)" id="ficha-peso">
          <input
            id="ficha-peso"
            type="number"
            step="0.1"
            className={fieldClass}
            value={form.peso}
            onChange={(e) => setForm((f) => ({ ...f, peso: e.target.value }))}
          />
        </Field>
        <Field label="Temperatura (°C)" id="ficha-temp">
          <input
            id="ficha-temp"
            type="number"
            step="0.1"
            className={fieldClass}
            value={form.temperatura}
            onChange={(e) => setForm((f) => ({ ...f, temperatura: e.target.value }))}
          />
        </Field>
        <Field label="Observaciones" id="ficha-obs" className="sm:col-span-2">
          <textarea
            id="ficha-obs"
            rows={2}
            className={fieldClass}
            value={form.observaciones}
            onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
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
    </form>
  );
}

function VacunaForm({ clinicaId, pacienteId, initial, onCancel, onSaved }) {
  const [form, setForm] = useState({
    nombre: initial?.nombre || "",
    fecha: initial?.fecha || new Date().toISOString().slice(0, 10),
    proxima_fecha: initial?.proxima_fecha || "",
    lote: initial?.lote || "",
    notas: initial?.notas || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (initial?.id) {
        await actualizarVacuna(initial.id, form);
      } else {
        await crearVacuna(clinicaId, { ...form, paciente_id: pacienteId });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-2 sm:grid-cols-2">
      <Field label="Vacuna" id="vac-nom">
        <input
          id="vac-nom"
          required
          className={fieldClass}
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
        />
      </Field>
      <Field label="Fecha" id="vac-fecha">
        <input
          id="vac-fecha"
          type="date"
          required
          className={fieldClass}
          value={form.fecha}
          onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
        />
      </Field>
      <Field label="Próxima" id="vac-prox">
        <input
          id="vac-prox"
          type="date"
          className={fieldClass}
          value={form.proxima_fecha}
          onChange={(e) => setForm((f) => ({ ...f, proxima_fecha: e.target.value }))}
        />
      </Field>
      <Field label="Lote" id="vac-lote">
        <input
          id="vac-lote"
          className={fieldClass}
          value={form.lote}
          onChange={(e) => setForm((f) => ({ ...f, lote: e.target.value }))}
        />
      </Field>
      {error ? <p className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={saving} className={primaryBtnClass}>
          {saving ? "…" : "Guardar"}
        </button>
        <button type="button" className={secondaryBtnClass} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function DesparaForm({ clinicaId, pacienteId, initial, onCancel, onSaved }) {
  const [form, setForm] = useState({
    producto: initial?.producto || "",
    fecha: initial?.fecha || new Date().toISOString().slice(0, 10),
    proxima_fecha: initial?.proxima_fecha || "",
    notas: initial?.notas || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (initial?.id) {
        await actualizarDesparasitacion(initial.id, form);
      } else {
        await crearDesparasitacion(clinicaId, { ...form, paciente_id: pacienteId });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-2 sm:grid-cols-2">
      <Field label="Producto" id="desp-prod">
        <input
          id="desp-prod"
          required
          className={fieldClass}
          value={form.producto}
          onChange={(e) => setForm((f) => ({ ...f, producto: e.target.value }))}
        />
      </Field>
      <Field label="Fecha" id="desp-fecha">
        <input
          id="desp-fecha"
          type="date"
          required
          className={fieldClass}
          value={form.fecha}
          onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
        />
      </Field>
      <Field label="Próxima" id="desp-prox">
        <input
          id="desp-prox"
          type="date"
          className={fieldClass}
          value={form.proxima_fecha}
          onChange={(e) => setForm((f) => ({ ...f, proxima_fecha: e.target.value }))}
        />
      </Field>
      <Field label="Notas" id="desp-notas">
        <input
          id="desp-notas"
          className={fieldClass}
          value={form.notas}
          onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
        />
      </Field>
      {error ? <p className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={saving} className={primaryBtnClass}>
          {saving ? "…" : "Guardar"}
        </button>
        <button type="button" className={secondaryBtnClass} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ArchivoForm({ clinicaId, pacienteId, initial, onCancel, onSaved }) {
  const [form, setForm] = useState({
    nombre: initial?.nombre || "",
    tipo: initial?.tipo || "estudio",
    url: initial?.url || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (initial?.id) {
        await actualizarArchivo(initial.id, form);
      } else {
        await crearArchivo(clinicaId, { ...form, paciente_id: pacienteId });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-2 sm:grid-cols-3">
      <Field label="Nombre" id="arch-nom">
        <input
          id="arch-nom"
          required
          className={fieldClass}
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
        />
      </Field>
      <Field label="Tipo" id="arch-tipo">
        <select
          id="arch-tipo"
          className={fieldClass}
          value={form.tipo}
          onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
        >
          <option value="estudio">Estudio</option>
          <option value="radiografia">Radiografía</option>
          <option value="laboratorio">Laboratorio</option>
          <option value="receta">Receta</option>
          <option value="otro">Otro</option>
        </select>
      </Field>
      <Field label="URL" id="arch-url">
        <input
          id="arch-url"
          required
          type="url"
          className={fieldClass}
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          placeholder="https://…"
        />
      </Field>
      {error ? <p className="text-sm text-red-700 sm:col-span-3">{error}</p> : null}
      <div className="flex gap-2 sm:col-span-3">
        <button type="submit" disabled={saving} className={primaryBtnClass}>
          {saving ? "…" : "Guardar"}
        </button>
        <button type="button" className={secondaryBtnClass} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
