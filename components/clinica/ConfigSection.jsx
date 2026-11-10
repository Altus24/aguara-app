"use client";

import { useEffect, useState } from "react";

import SignaturePad from "@/components/clinica/SignaturePad";
import {
  Field,
  cardClass,
  fieldClass,
  formatTime,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/clinica/ui";
import {
  actualizarVeterinario,
  crearVeterinario,
  eliminarVeterinario,
  listarVeterinarios,
} from "@/lib/chapitas/clinicaOps";
import {
  DIAS_SEMANA,
  actualizarClinica,
  actualizarStockProducto,
  crearHorario,
  crearProducto,
  crearServicio,
  eliminarHorario,
  eliminarProducto,
  eliminarServicio,
  listarHorarios,
  listarProductos,
  listarServicios,
} from "@/lib/chapitas/clinicas";

const SUBTABS = [
  { id: "ubicacion", label: "Ubicación" },
  { id: "vets", label: "Veterinarios" },
  { id: "servicios", label: "Servicios" },
  { id: "horarios", label: "Horarios" },
  { id: "stock", label: "Stock" },
];

export default function ConfigSection({ clinica, onSaved }) {
  const [tab, setTab] = useState("ubicacion");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-aguara-ink">Configuración</h2>
        <p className="text-sm text-stone-500">Datos del local, equipo, servicios y stock</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SUBTABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              tab === item.id
                ? "bg-aguara-orange text-white"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "ubicacion" ? <Ubicacion clinica={clinica} onSaved={onSaved} /> : null}
      {tab === "vets" ? <Veterinarios clinicaId={clinica.id} /> : null}
      {tab === "servicios" ? <Servicios clinicaId={clinica.id} /> : null}
      {tab === "horarios" ? <Horarios clinicaId={clinica.id} /> : null}
      {tab === "stock" ? <Stock clinicaId={clinica.id} /> : null}
    </div>
  );
}

function Ubicacion({ clinica, onSaved }) {
  const [form, setForm] = useState({
    nombre: clinica.nombre || "",
    telefono: clinica.telefono || "",
    direccion: clinica.direccion || "",
    ciudad: clinica.ciudad || "",
    provincia: clinica.provincia || "Mendoza",
    descripcion: clinica.descripcion || "",
    maps_url: clinica.maps_url || "",
    permite_citas_tutor: clinica.permite_citas_tutor !== false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await actualizarClinica(clinica.id, {
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim(),
        direccion: form.direccion.trim(),
        ciudad: form.ciudad.trim(),
        provincia: form.provincia.trim(),
        descripcion: form.descripcion.trim() || null,
        maps_url: form.maps_url.trim() || null,
        permite_citas_tutor: Boolean(form.permite_citas_tutor),
      });
      onSaved(updated);
      setMessage("Ubicación guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-4`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" id="cfg-nombre">
          <input
            id="cfg-nombre"
            required
            className={fieldClass}
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          />
        </Field>
        <Field label="Teléfono" id="cfg-tel">
          <input
            id="cfg-tel"
            required
            className={fieldClass}
            value={form.telefono}
            onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
          />
        </Field>
        <Field label="Dirección" id="cfg-dir" className="sm:col-span-2">
          <input
            id="cfg-dir"
            required
            className={fieldClass}
            value={form.direccion}
            onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
          />
        </Field>
        <Field label="Ciudad" id="cfg-ciudad">
          <input
            id="cfg-ciudad"
            required
            className={fieldClass}
            value={form.ciudad}
            onChange={(e) => setForm((f) => ({ ...f, ciudad: e.target.value }))}
          />
        </Field>
        <Field label="Provincia" id="cfg-prov">
          <input
            id="cfg-prov"
            className={fieldClass}
            value={form.provincia}
            onChange={(e) => setForm((f) => ({ ...f, provincia: e.target.value }))}
          />
        </Field>
        <Field label="Google Maps" id="cfg-maps" className="sm:col-span-2">
          <input
            id="cfg-maps"
            type="url"
            className={fieldClass}
            value={form.maps_url}
            onChange={(e) => setForm((f) => ({ ...f, maps_url: e.target.value }))}
          />
        </Field>
        <Field label="Descripción" id="cfg-desc" className="sm:col-span-2">
          <textarea
            id="cfg-desc"
            rows={3}
            className={fieldClass}
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={form.permite_citas_tutor}
            onChange={(e) =>
              setForm((f) => ({ ...f, permite_citas_tutor: e.target.checked }))
            }
          />
          Permitir que tutores soliciten / reprogramen citas online
        </label>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      <button type="submit" disabled={saving} className={primaryBtnClass}>
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}

const emptyVetForm = {
  nombre: "",
  especialidad: "",
  email: "",
  matricula: "",
  firma_digital: "",
};

function Veterinarios({ clinicaId }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyVetForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [firmaKey, setFirmaKey] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function reload() {
    setItems(await listarVeterinarios(clinicaId));
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyVetForm);
    setFirmaKey((k) => k + 1);
    setShowForm(true);
    setError("");
  }

  function openEdit(vet) {
    setEditingId(vet.id);
    setForm({
      nombre: vet.nombre || "",
      especialidad: vet.especialidad || "",
      email: vet.email || "",
      matricula: vet.matricula || "",
      firma_digital: vet.firma_digital || "",
    });
    setFirmaKey((k) => k + 1);
    setShowForm(true);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!form.matricula.trim()) {
        throw new Error("La matrícula es obligatoria.");
      }
      if (!form.firma_digital) {
        throw new Error("Agregá la firma digital del veterinario.");
      }
      if (editingId) {
        await actualizarVeterinario(editingId, form);
      } else {
        await crearVeterinario(clinicaId, form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyVetForm);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el veterinario.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className={`${cardClass} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <h3 className="font-semibold text-aguara-ink">Registro de veterinarios</h3>
          <p className="text-sm text-stone-500">
            Nombre, matrícula profesional y firma digital para cerrar consultas
          </p>
        </div>
        <button type="button" className={primaryBtnClass} onClick={openCreate}>
          Nuevo veterinario
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className={`${cardClass} space-y-4`}>
          <h4 className="font-semibold text-aguara-ink">
            {editingId ? "Editar veterinario" : "Registrar veterinario"}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre completo" id="vet-nombre">
              <input
                id="vet-nombre"
                required
                className={fieldClass}
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </Field>
            <Field label="Matrícula" id="vet-mat">
              <input
                id="vet-mat"
                required
                placeholder="Ej: MP 12345"
                className={fieldClass}
                value={form.matricula}
                onChange={(e) => setForm((f) => ({ ...f, matricula: e.target.value }))}
              />
            </Field>
            <Field label="Especialidad" id="vet-esp">
              <input
                id="vet-esp"
                className={fieldClass}
                value={form.especialidad}
                onChange={(e) => setForm((f) => ({ ...f, especialidad: e.target.value }))}
              />
            </Field>
            <Field label="Email" id="vet-email">
              <input
                id="vet-email"
                type="email"
                className={fieldClass}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Firma digital" id="vet-firma">
            <SignaturePad
              key={firmaKey}
              value={form.firma_digital}
              onChange={(dataUrl) => setForm((f) => ({ ...f, firma_digital: dataUrl }))}
            />
          </Field>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className={primaryBtnClass}>
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Registrar"}
            </button>
            <button
              type="button"
              className={secondaryBtnClass}
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className={cardClass}>
        {items.length === 0 ? (
          <p className="text-sm text-stone-500">Todavía no hay veterinarios registrados.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {items.map((v) => (
              <li
                key={v.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  {v.firma_digital ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.firma_digital}
                      alt={`Firma de ${v.nombre}`}
                      className="h-12 w-28 rounded border border-stone-200 bg-white object-contain"
                    />
                  ) : (
                    <span className="grid h-12 w-28 place-items-center rounded border border-dashed border-stone-300 text-xs text-stone-400">
                      Sin firma
                    </span>
                  )}
                  <div>
                    <p className="font-medium text-aguara-ink">{v.nombre}</p>
                    <p className="text-sm text-stone-500">
                      Mat. {v.matricula || "—"}
                      {v.especialidad ? ` · ${v.especialidad}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  <button
                    type="button"
                    className="text-aguara-orange underline"
                    onClick={() => openEdit(v)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="text-stone-500 underline hover:text-red-700"
                    onClick={async () => {
                      if (!confirm(`¿Eliminar a ${v.nombre}?`)) return;
                      await eliminarVeterinario(v.id);
                      await reload();
                    }}
                  >
                    Quitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Servicios({ clinicaId }) {
  const [items, setItems] = useState([]);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    setItems(await listarServicios(clinicaId));
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId]);

  return (
    <div className={`${cardClass} space-y-4`}>
      <h3 className="font-semibold text-aguara-ink">Servicios</h3>
      <form
        className="grid gap-3 sm:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await crearServicio(clinicaId, { nombre, precio, descripcion });
            setNombre("");
            setPrecio("");
            setDescripcion("");
            await reload();
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <input
          required
          placeholder="Nombre"
          className={`${fieldClass} sm:col-span-2`}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <input
          type="number"
          placeholder="Precio"
          className={fieldClass}
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
        />
        <button type="submit" className={primaryBtnClass}>
          Agregar
        </button>
        <input
          placeholder="Descripción"
          className={`${fieldClass} sm:col-span-4`}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <ul className="divide-y divide-stone-100">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3 py-2 text-sm">
            <span>
              <strong>{item.nombre}</strong>
              {item.precio != null ? ` · $${item.precio}` : ""}
            </span>
            <button
              type="button"
              className="text-stone-500 underline"
              onClick={async () => {
                await eliminarServicio(item.id);
                await reload();
              }}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Horarios({ clinicaId }) {
  const [items, setItems] = useState([]);
  const [vets, setVets] = useState([]);
  const [veterinarioId, setVeterinarioId] = useState("");
  const [filtroVet, setFiltroVet] = useState("");
  const [diaSemana, setDiaSemana] = useState("1");
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFin, setHoraFin] = useState("18:00");
  const [error, setError] = useState("");

  async function reload() {
    const [horarios, veterinarios] = await Promise.all([
      listarHorarios(clinicaId),
      listarVeterinarios(clinicaId),
    ]);
    setItems(horarios);
    setVets(veterinarios.filter((v) => v.activo !== false));
    if (!veterinarioId && veterinarios[0]?.id) {
      setVeterinarioId(veterinarios[0].id);
    }
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId]);

  const visibles = filtroVet
    ? items.filter((h) => h.veterinario_id === filtroVet)
    : items;

  return (
    <div className={`${cardClass} space-y-4`}>
      <div>
        <h3 className="font-semibold text-aguara-ink">Horarios por veterinario</h3>
        <p className="text-sm text-stone-500">
          Cada veterinario define sus propios días y franjas de atención.
        </p>
      </div>
      {vets.length === 0 ? (
        <p className="text-sm text-amber-800">
          Primero registrá veterinarios en la pestaña Veterinarios.
        </p>
      ) : null}
      <form
        className="grid gap-3 sm:grid-cols-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await crearHorario(clinicaId, {
              diaSemana,
              horaInicio,
              horaFin,
              veterinarioId,
            });
            await reload();
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <select
          className={fieldClass}
          required
          value={veterinarioId}
          onChange={(e) => setVeterinarioId(e.target.value)}
        >
          <option value="">Veterinario…</option>
          {vets.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nombre}
            </option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={diaSemana}
          onChange={(e) => setDiaSemana(e.target.value)}
        >
          {DIAS_SEMANA.map((n, i) => (
            <option key={n} value={i}>
              {n}
            </option>
          ))}
        </select>
        <input
          type="time"
          className={fieldClass}
          value={horaInicio}
          onChange={(e) => setHoraInicio(e.target.value)}
        />
        <input
          type="time"
          className={fieldClass}
          value={horaFin}
          onChange={(e) => setHoraFin(e.target.value)}
        />
        <button type="submit" className={primaryBtnClass} disabled={!veterinarioId}>
          Agregar
        </button>
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !filtroVet ? "bg-aguara-orange text-white" : "bg-stone-100 text-stone-700"
          }`}
          onClick={() => setFiltroVet("")}
        >
          Todos
        </button>
        {vets.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filtroVet === v.id ? "bg-aguara-orange text-white" : "bg-stone-100 text-stone-700"
            }`}
            onClick={() => setFiltroVet(v.id)}
          >
            {v.nombre}
          </button>
        ))}
      </div>
      <ul className="space-y-2 text-sm">
        {visibles.length === 0 ? (
          <li className="text-stone-500">Sin horarios cargados.</li>
        ) : (
          visibles.map((slot) => (
            <li key={slot.id} className="flex justify-between gap-3">
              <span>
                <span className="font-medium text-aguara-ink">
                  {slot.clinica_veterinarios?.nombre || "General (legado)"}
                </span>
                {" · "}
                {DIAS_SEMANA[slot.dia_semana]} · {formatTime(slot.hora_inicio)}–
                {formatTime(slot.hora_fin)}
              </span>
              <button
                type="button"
                className="shrink-0 text-stone-500 underline"
                onClick={async () => {
                  await eliminarHorario(slot.id);
                  await reload();
                }}
              >
                Quitar
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function Stock({ clinicaId }) {
  const [items, setItems] = useState([]);
  const [nombre, setNombre] = useState("");
  const [stock, setStock] = useState("0");
  const [unidad, setUnidad] = useState("u");
  const [precio, setPrecio] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    setItems(await listarProductos(clinicaId));
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId]);

  return (
    <div className={`${cardClass} space-y-4`}>
      <h3 className="font-semibold text-aguara-ink">Stock</h3>
      <form
        className="grid gap-3 sm:grid-cols-5"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await crearProducto(clinicaId, { nombre, stock, unidad, precio });
            setNombre("");
            setStock("0");
            setUnidad("u");
            setPrecio("");
            await reload();
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <input
          required
          placeholder="Producto"
          className={`${fieldClass} sm:col-span-2`}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <input
          type="number"
          className={fieldClass}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
        <input
          className={fieldClass}
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
        />
        <button type="submit" className={primaryBtnClass}>
          Agregar
        </button>
        <input
          type="number"
          placeholder="Precio"
          className={`${fieldClass} sm:col-span-5`}
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
        />
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <ul className="divide-y divide-stone-100">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span>
              <strong>{item.nombre}</strong>
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                defaultValue={item.stock}
                className="w-20 rounded-md border border-stone-300 px-2 py-1"
                onBlur={async (e) => {
                  if (String(item.stock) === e.target.value) return;
                  await actualizarStockProducto(item.id, e.target.value);
                  await reload();
                }}
              />
              <span>{item.unidad}</span>
              <button
                type="button"
                className="underline"
                onClick={async () => {
                  await eliminarProducto(item.id);
                  await reload();
                }}
              >
                Quitar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
