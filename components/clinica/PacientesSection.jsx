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
import { confirmGuardar } from "@/lib/confirmAction";

const ESPECIES = ["Perro", "Gato", "Ave", "Conejo", "Otro"];

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
    nombre: "",
    especie: "Perro",
    raza: "",
    sexo: "",
    fecha_nacimiento: "",
    peso: "",
    color: "",
    chip: "",
    alergias: "",
    notas: "",
    chapita_codigo: "",
    nuevo_cliente_nombre: "",
    nuevo_cliente_email: "",
    nuevo_cliente_telefono: "",
    nuevo_cliente_telefono_secundario: "",
    nuevo_cliente_direccion: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [crearDueño, setCrearDueño] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
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
      if (!form.nombre.trim()) throw new Error("Completá el nombre de la mascota.");
      if (!form.sexo) throw new Error("Seleccioná el sexo de la mascota.");
      await crearPaciente(clinicaId, {
        cliente_id: clienteId,
        nombre: form.nombre,
        especie: form.especie,
        raza: form.raza,
        sexo: form.sexo,
        fecha_nacimiento: form.fecha_nacimiento,
        peso: form.peso,
        color: form.color,
        chip: form.chip,
        alergias: form.alergias,
        notas: form.notas,
        chapita_codigo: form.chapita_codigo,
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

      <div className="space-y-3">
        <p className="text-sm font-medium text-aguara-ink">Datos de la mascota</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre *" id="np-nombre">
            <input
              id="np-nombre"
              required
              className={fieldClass}
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </Field>
          <Field label="Especie *" id="np-especie">
            <select
              id="np-especie"
              required
              className={fieldClass}
              value={form.especie}
              onChange={(e) => setForm((f) => ({ ...f, especie: e.target.value }))}
            >
              {ESPECIES.map((esp) => (
                <option key={esp} value={esp}>
                  {esp}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Raza" id="np-raza">
            <input
              id="np-raza"
              className={fieldClass}
              value={form.raza}
              onChange={(e) => setForm((f) => ({ ...f, raza: e.target.value }))}
            />
          </Field>
          <Field label="Sexo *" id="np-sexo">
            <select
              id="np-sexo"
              required
              className={fieldClass}
              value={form.sexo}
              onChange={(e) => setForm((f) => ({ ...f, sexo: e.target.value }))}
            >
              <option value="">Elegí…</option>
              <option value="Macho">Macho</option>
              <option value="Hembra">Hembra</option>
            </select>
          </Field>
          <Field label="Fecha de nacimiento" id="np-fnac">
            <input
              id="np-fnac"
              type="date"
              className={fieldClass}
              value={form.fecha_nacimiento}
              onChange={(e) =>
                setForm((f) => ({ ...f, fecha_nacimiento: e.target.value }))
              }
            />
          </Field>
          <Field label="Peso (kg)" id="np-peso">
            <input
              id="np-peso"
              type="number"
              step="0.1"
              min="0"
              className={fieldClass}
              value={form.peso}
              onChange={(e) => setForm((f) => ({ ...f, peso: e.target.value }))}
            />
          </Field>
          <Field label="Color" id="np-color">
            <input
              id="np-color"
              className={fieldClass}
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            />
          </Field>
          <Field label="N° de chip" id="np-chip">
            <input
              id="np-chip"
              className={fieldClass}
              value={form.chip}
              onChange={(e) => setForm((f) => ({ ...f, chip: e.target.value }))}
            />
          </Field>
          <Field label="Código chapita (opcional)" id="np-chapita">
            <input
              id="np-chapita"
              className={fieldClass}
              placeholder="Ej. T1-004"
              value={form.chapita_codigo}
              onChange={(e) =>
                setForm((f) => ({ ...f, chapita_codigo: e.target.value }))
              }
            />
          </Field>
          <Field label="Alergias" id="np-alergias">
            <input
              id="np-alergias"
              className={fieldClass}
              value={form.alergias}
              onChange={(e) => setForm((f) => ({ ...f, alergias: e.target.value }))}
            />
          </Field>
          <Field label="Notas" id="np-notas" className="sm:col-span-2">
            <textarea
              id="np-notas"
              rows={2}
              className={fieldClass}
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            />
          </Field>
        </div>
      </div>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const p = await obtenerPaciente(pacienteId);
        const [c, v, d, a] = await Promise.all([
          listarConsultas(clinicaId, { pacienteId }),
          listarVacunasPacienteCompletas(p),
          listarDesparasitaciones(pacienteId),
          listarArchivos(pacienteId),
        ]);
        if (!cancelled) {
          setPaciente(p);
          setConsultas(c);
          setVacunas(v);
          setDesparas(d);
          setArchivos(a);
        }
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
  }, [clinicaId, pacienteId]);

  if (loading) return <p className="text-sm text-stone-500">Cargando ficha…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
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
          Dueño: <strong>{paciente.clinica_clientes?.nombre_completo}</strong>
          {paciente.clinica_clientes?.telefono
            ? ` · ${paciente.clinica_clientes.telefono}`
            : ""}
        </p>
        {paciente.alergias ? (
          <p className="mt-2 text-sm text-amber-800">Alergias: {paciente.alergias}</p>
        ) : null}
        {paciente.chip ? <p className="mt-1 text-sm text-stone-500">Chip: {paciente.chip}</p> : null}
      </div>

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Historial completo</h3>
        {consultas.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Sin consultas registradas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {consultas.map((c) => (
              <li key={c.id} className="py-3">
                <p className="font-medium text-aguara-ink">
                  {formatDateTime(c.fecha)}
                  {c.cerrada ? " · Cerrada" : " · Abierta"}
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
              </li>
            ))}
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
