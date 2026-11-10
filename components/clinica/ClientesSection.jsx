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
  crearPago,
  listarClientes,
  listarConsultas,
  listarPacientesDeCliente,
  listarPagos,
  listarSolicitudesPerfilClinica,
  money,
  obtenerCliente,
  proponerOActualizarDatosTutor,
} from "@/lib/chapitas/clinicaOps";

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
          <h2 className="text-lg font-semibold text-aguara-ink">Clientes (tutor)</h2>
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

function NuevoClienteForm({ clinicaId, onCreated }) {
  const [form, setForm] = useState({
    nombre_completo: "",
    email: "",
    telefono: "",
    telefono_secundario: "",
    direccion: "",
    notas: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await crearCliente(clinicaId, form);
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-3`}>
      <h3 className="font-semibold text-aguara-ink">Nuevo cliente</h3>
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
        <Field label="Email" id="cli-email">
          <input
            id="cli-email"
            type="email"
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
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={saving} className={primaryBtnClass}>
        {saving ? "Guardando…" : "Guardar cliente"}
      </button>
    </form>
  );
}

function FichaCliente({ clinicaId, clinicaNombre, clienteId, onBack }) {
  const [cliente, setCliente] = useState(null);
  const [mascotas, setMascotas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
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
      const [c, m, p, sols] = await Promise.all([
        obtenerCliente(clienteId),
        listarPacientesDeCliente(clienteId),
        listarPagos(clinicaId, { clienteId }),
        listarSolicitudesPerfilClinica(clinicaId, { soloPendientes: true }),
      ]);
      setCliente(c);
      setMascotas(m);
      setPagos(p);
      setPendientes((sols || []).filter((s) => s.cliente_id === clienteId));
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

  if (loading) return <p className="text-sm text-stone-500">Cargando cliente…</p>;
  if (!cliente) {
    return error ? <p className="text-sm text-red-700">{error}</p> : null;
  }

  return (
    <div className="space-y-5">
      <button type="button" className={secondaryBtnClass} onClick={onBack}>
        ← Volver
      </button>

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

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={cardClass}>
          <h3 className="font-semibold text-aguara-ink">Mascotas asociadas</h3>
          {mascotas.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Sin mascotas.</p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {mascotas.map((m) => (
                <li key={m.id} className="py-2 text-sm">
                  <strong>{m.nombre}</strong> · {m.especie}
                  {m.raza ? ` · ${m.raza}` : ""}
                </li>
              ))}
            </ul>
          )}
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
