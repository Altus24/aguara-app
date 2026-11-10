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
  crearCliente,
  crearPaciente,
  listarArchivos,
  listarClientes,
  listarConsultas,
  listarDesparasitaciones,
  listarPacientes,
  listarVacunas,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [p, c, v, d, a] = await Promise.all([
          obtenerPaciente(pacienteId),
          listarConsultas(clinicaId, { pacienteId }),
          listarVacunas(pacienteId),
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
                <p className="text-sm text-stone-600">Motivo de consulta:{c.motivo || "Consulta"}</p>
                {c.diagnostico ? (
                  <p className="mt-1 text-sm text-stone-700">Diagnóstico: {c.diagnostico}</p>
                ) : null}
                {c.tratamiento ? (
                  <p className="text-sm text-stone-700">Tratamiento: {c.tratamiento}</p>
                ) : null}
                {c.medicacion ? (
                  <p className="text-sm text-stone-700">Medicación: {c.medicacion}</p>
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
