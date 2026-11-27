"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { confirmEliminar } from "@/lib/confirmAction";
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
  ESPECIALIDAD_OTRA,
  opcionesEspecialidad,
  valorSelectEspecialidad,
} from "@/lib/chapitas/especialidadesVet";
import { confirmGuardar } from "@/lib/confirmAction";
import {
  ciudadesDeProvincia,
  provinciaPorDefecto,
  provinciasDisponibles,
} from "@/lib/chapitas/ubicacionesAr";
import {
  DIAS_SEMANA,
  actualizarClinica,
  actualizarServicio,
  actualizarStockProducto,
  crearHorario,
  crearProducto,
  crearServicio,
  eliminarHorario,
  eliminarProducto,
  eliminarServicio,
  esServicioGeneral,
  esServicioVacunacion,
  guardarServiciosDeVeterinario,
  listarHorarios,
  listarIdsServiciosDeVeterinario,
  listarProductos,
  listarServicios,
  listarServiciosGenerales,
  subirLogoClinica,
} from "@/lib/chapitas/clinicas";
import RecetaConfigPanel from "@/components/clinica/RecetaConfigPanel";

const SUBTABS = [
  { id: "ubicacion", label: "Perfil" },
  { id: "receta", label: "Receta" },
  { id: "horarios", label: "Horario" },
  { id: "vets", label: "Veterinarios" },
  { id: "servicios", label: "Servicios" },
  { id: "stock", label: "Stock" },
];

const CONFIG_TAB_KEY = "aguara_clinica_config_tab";
const CONFIG_TAB_IDS = new Set(SUBTABS.map((item) => item.id));

function readConfigTab() {
  if (typeof window === "undefined") return "ubicacion";
  try {
    const stored = window.sessionStorage.getItem(CONFIG_TAB_KEY);
    return CONFIG_TAB_IDS.has(stored) ? stored : "ubicacion";
  } catch {
    return "ubicacion";
  }
}

export default function ConfigSection({ clinica, onSaved }) {
  const [tab, setTab] = useState(readConfigTab);

  function selectTab(next) {
    setTab(next);
    try {
      window.sessionStorage.setItem(CONFIG_TAB_KEY, next);
    } catch {
      /* ignore */
    }
  }

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
            onClick={() => selectTab(item.id)}
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
      {tab === "receta" ? <RecetaConfigPanel clinica={clinica} onSaved={onSaved} /> : null}
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
    provincia: clinica.provincia || provinciaPorDefecto(),
    descripcion: clinica.descripcion || "",
    maps_url: clinica.maps_url || "",
    permite_citas_tutor: clinica.permite_citas_tutor !== false,
  });
  const [logoUrl, setLogoUrl] = useState(clinica.logo_url || "");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(clinica.logo_url || "");
  const [quitarLogo, setQuitarLogo] = useState(false);
  const logoInputRef = useRef(null);
  const logoPreviewRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const provincias = useMemo(() => provinciasDisponibles(), []);
  const ciudades = useMemo(() => ciudadesDeProvincia(form.provincia), [form.provincia]);

  useEffect(() => {
    setLogoUrl(clinica.logo_url || "");
    setLogoPreview(clinica.logo_url || "");
    setLogoFile(null);
    setQuitarLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }, [clinica.id, clinica.logo_url]);

  useEffect(() => {
    return () => {
      if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    };
  }, []);

  function onLogoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("El logo tiene que ser JPG, PNG o WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("El logo no puede superar 2 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    const url = URL.createObjectURL(file);
    logoPreviewRef.current = url;
    setLogoFile(file);
    setLogoPreview(url);
    setQuitarLogo(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!(await confirmGuardar("la ubicación de la clínica"))) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      let nextLogoUrl = logoUrl || null;
      if (quitarLogo) nextLogoUrl = null;
      else if (logoFile) nextLogoUrl = await subirLogoClinica(clinica.id, logoFile);

      const updated = await actualizarClinica(clinica.id, {
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim(),
        direccion: form.direccion.trim(),
        ciudad: form.ciudad.trim(),
        provincia: form.provincia.trim(),
        descripcion: form.descripcion.trim() || null,
        maps_url: form.maps_url.trim() || null,
        permite_citas_tutor: Boolean(form.permite_citas_tutor),
        logo_url: nextLogoUrl,
      });
      setLogoUrl(updated.logo_url || "");
      setLogoPreview(updated.logo_url || "");
      setLogoFile(null);
      setQuitarLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
      onSaved?.(updated);
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
        <Field label="Logo de la clínica" id="cfg-logo" className="sm:col-span-2">
          <div className="flex flex-wrap items-center gap-4">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview}
                alt={`Logo de ${form.nombre || "la clínica"}`}
                className="h-20 w-20 rounded-xl border border-stone-200 bg-white object-contain p-1"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 text-xs text-stone-400">
                Sin logo
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <input
                ref={logoInputRef}
                id="cfg-logo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={fieldClass}
                onChange={onLogoChange}
              />
              <p className="text-xs text-stone-400">
                JPG, PNG o WebP · máx. 2 MB. Lo ven los tutores en turnos y perfil.
              </p>
              {logoPreview || logoUrl ? (
                <button
                  type="button"
                  className={secondaryBtnClass}
                  onClick={() => {
                    setQuitarLogo(true);
                    setLogoFile(null);
                    setLogoPreview("");
                    if (logoPreviewRef.current) {
                      URL.revokeObjectURL(logoPreviewRef.current);
                      logoPreviewRef.current = null;
                    }
                    if (logoInputRef.current) logoInputRef.current.value = "";
                  }}
                >
                  Quitar logo
                </button>
              ) : null}
            </div>
          </div>
        </Field>
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
        <Field label="Provincia" id="cfg-prov">
          <select
            id="cfg-prov"
            required
            className={fieldClass}
            value={form.provincia}
            onChange={(e) => {
              const provincia = e.target.value;
              const nextCiudades = ciudadesDeProvincia(provincia);
              setForm((f) => ({
                ...f,
                provincia,
                ciudad: nextCiudades.includes(f.ciudad) ? f.ciudad : "",
              }));
            }}
          >
            {provincias.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ciudad / departamento" id="cfg-ciudad">
          <select
            id="cfg-ciudad"
            required
            className={fieldClass}
            value={form.ciudad}
            onChange={(e) => setForm((f) => ({ ...f, ciudad: e.target.value }))}
            disabled={!ciudades.length}
          >
            <option value="">Seleccioná…</option>
            {ciudades.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {form.ciudad && !ciudades.includes(form.ciudad) ? (
              <option value={form.ciudad}>{form.ciudad} (actual)</option>
            ) : null}
          </select>
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
  const [espSelect, setEspSelect] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [firmaKey, setFirmaKey] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const especialidadesOpts = useMemo(
    () => opcionesEspecialidad(items.map((v) => v.especialidad)),
    [items],
  );

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
    setEspSelect("");
    setFirmaKey((k) => k + 1);
    setShowForm(true);
    setError("");
    setMessage("");
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
    setEspSelect(valorSelectEspecialidad(vet.especialidad, especialidadesOpts));
    setFirmaKey((k) => k + 1);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!(await confirmGuardar(editingId ? "el perfil del veterinario" : "el nuevo veterinario"))) {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (!form.matricula.trim()) {
        throw new Error("La matrícula es obligatoria.");
      }
      if (!form.firma_digital) {
        throw new Error("Agregá la firma digital del veterinario.");
      }
      let vetId = editingId;
      if (editingId) {
        await actualizarVeterinario(editingId, form);
        setMessage("Perfil actualizado. Ahora podés cargar horarios y servicios abajo.");
      } else {
        const created = await crearVeterinario(clinicaId, form);
        vetId = created.id;
        setEditingId(created.id);
        setMessage(
          "Veterinario creado. Completá su agenda y los servicios que ofrece en las secciones de abajo.",
        );
      }
      await reload();
      if (!vetId) {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyVetForm);
      }
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
          <h3 className="font-semibold text-aguara-ink">Perfiles de veterinarios</h3>
          <p className="text-sm text-stone-500">
            Cada vet define su agenda y los servicios que ofrece, dentro del horario de apertura del
            local.
          </p>
        </div>
        <button type="button" className={primaryBtnClass} onClick={openCreate}>
          Nuevo veterinario
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className={`${cardClass} space-y-4`}>
          <h4 className="font-semibold text-aguara-ink">
            {editingId ? "Perfil del veterinario" : "Registrar veterinario"}
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
              <select
                id="vet-esp"
                className={fieldClass}
                value={espSelect}
                onChange={(e) => {
                  const value = e.target.value;
                  setEspSelect(value);
                  if (value === ESPECIALIDAD_OTRA) {
                    setForm((f) => ({ ...f, especialidad: "" }));
                  } else {
                    setForm((f) => ({ ...f, especialidad: value }));
                  }
                }}
              >
                <option value="">Sin especialidad</option>
                {especialidadesOpts.map((esp) => (
                  <option key={esp} value={esp}>
                    {esp}
                  </option>
                ))}
                <option value={ESPECIALIDAD_OTRA}>Otra (agregar)…</option>
              </select>
            </Field>
            {espSelect === ESPECIALIDAD_OTRA ? (
              <Field label="Nueva especialidad" id="vet-esp-otra">
                <input
                  id="vet-esp-otra"
                  required
                  className={fieldClass}
                  value={form.especialidad}
                  onChange={(e) => setForm((f) => ({ ...f, especialidad: e.target.value }))}
                  placeholder="Escribí la especialidad"
                />
              </Field>
            ) : null}
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
          <Field label="Firma digital (dibujar o subir imagen)" id="vet-firma">
            <SignaturePad
              key={firmaKey}
              value={form.firma_digital}
              onChange={(dataUrl) => setForm((f) => ({ ...f, firma_digital: dataUrl }))}
            />
            <p className="mt-1 text-xs text-stone-500">
              Podés firmar en pantalla o subir una foto/escaneo de la firma (JPG, PNG o WebP, máx. 2
              MB). Se usa al cerrar historias clínicas.
            </p>
          </Field>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className={primaryBtnClass}>
              {saving ? "Guardando…" : editingId ? "Guardar perfil" : "Registrar"}
            </button>
            <button
              type="button"
              className={secondaryBtnClass}
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setMessage("");
              }}
            >
              Cerrar
            </button>
          </div>
          {!editingId ? (
            <p className="text-xs text-stone-500">
              Después de registrar al veterinario vas a poder cargar su horario y servicios.
            </p>
          ) : null}
        </form>
      ) : null}

      {showForm && editingId ? (
        <div className={`${cardClass} space-y-4`}>
          <h4 className="font-semibold text-aguara-ink">Agenda y servicios</h4>
          <VetHorariosPanel clinicaId={clinicaId} veterinarioId={editingId} />
          <VetServiciosPanel clinicaId={clinicaId} veterinarioId={editingId} />
        </div>
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
                    Perfil / horarios
                  </button>
                  <button
                    type="button"
                    className="text-stone-500 underline hover:text-red-700"
                    onClick={async () => {
                      if (!(await confirmEliminar(`al veterinario ${v.nombre}`))) return;
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

function VetHorariosPanel({ clinicaId, veterinarioId }) {
  const [items, setItems] = useState([]);
  const [diaSemana, setDiaSemana] = useState("1");
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFin, setHoraFin] = useState("18:00");
  const [error, setError] = useState("");

  async function reload() {
    const all = await listarHorarios(clinicaId, { veterinarioId });
    setItems(all.filter((h) => h.veterinario_id === veterinarioId));
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId, veterinarioId]);

  return (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
      <div>
        <h5 className="text-sm font-semibold text-aguara-ink">Su agenda semanal</h5>
        <p className="text-xs text-stone-500">
          Solo puede atender dentro del horario de apertura del local.
        </p>
      </div>
      <form
        className="grid gap-2 sm:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!(await confirmGuardar("el horario del veterinario"))) return;
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
        <button type="submit" className={primaryBtnClass}>
          Agregar
        </button>
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <ul className="space-y-1 text-sm">
        {items.length === 0 ? (
          <li className="text-stone-500">Sin franjas cargadas.</li>
        ) : (
          items.map((slot) => (
            <li key={slot.id} className="flex justify-between gap-3">
              <span>
                {DIAS_SEMANA[slot.dia_semana]} · {formatTime(slot.hora_inicio)}–
                {formatTime(slot.hora_fin)}
              </span>
              <button
                type="button"
                className="text-stone-500 underline"
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

function VetServiciosPanel({ clinicaId, veterinarioId }) {
  const [servicios, setServicios] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function reload() {
    const [all, ids] = await Promise.all([
      listarServicios(clinicaId),
      listarIdsServiciosDeVeterinario(veterinarioId),
    ]);
    setServicios(all.filter((s) => s.activo !== false));
    setSelected(ids);
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId, veterinarioId]);

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
      <div>
        <h5 className="text-sm font-semibold text-aguara-ink">Servicios que ofrece</h5>
        <p className="text-xs text-stone-500">
          Al crear una cita, solo se listarán estos servicios para este veterinario.
        </p>
      </div>
      {servicios.length === 0 ? (
        <p className="text-sm text-stone-500">
          Todavía no hay servicios de la clínica. Creá algunos en la pestaña Servicios.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {servicios.map((s) => (
            <li key={s.id}>
              <label className="flex items-center gap-2 text-sm text-stone-800">
                <input
                  type="checkbox"
                  checked={selected.includes(s.id)}
                  onChange={() => toggle(s.id)}
                />
                {s.nombre}
                {esServicioVacunacion(s) ? (
                  <span className="text-[11px] text-emerald-700">vacunación</span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      <button
        type="button"
        className={primaryBtnClass}
        disabled={saving || servicios.length === 0}
        onClick={async () => {
          setSaving(true);
          setError("");
          setMessage("");
          try {
            if (!(await confirmGuardar("los servicios del veterinario"))) return;
            await guardarServiciosDeVeterinario(veterinarioId, selected);
            setMessage("Servicios actualizados.");
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudieron guardar.");
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Guardando…" : "Guardar servicios"}
      </button>
    </div>
  );
}

function Servicios({ clinicaId }) {
  const [items, setItems] = useState([]);
  const [catalogoCodigos, setCatalogoCodigos] = useState(() => new Set());
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function reload() {
    const [rows, catalogo] = await Promise.all([
      listarServicios(clinicaId),
      listarServiciosGenerales(),
    ]);
    setCatalogoCodigos(new Set(catalogo.map((g) => String(g.codigo).toLowerCase())));
    setItems(rows);
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId]);

  const generales = [];
  const vistos = new Set();
  for (const item of items) {
    if (!esServicioGeneral(item, catalogoCodigos)) continue;
    const codigo = String(item.codigo || "").toLowerCase();
    if (vistos.has(codigo)) continue;
    vistos.add(codigo);
    generales.push(item);
  }
  const propios = items.filter((item) => !esServicioGeneral(item, catalogoCodigos));

  async function toggleOfrece(item) {
    setBusyId(item.id);
    setError("");
    try {
      const next = item.activo === false;
      await actualizarServicio(item.id, { activo: next });
      setItems((prev) => prev.map((s) => (s.id === item.id ? { ...s, activo: next } : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setBusyId("");
    }
  }

  async function guardarPrecio(item, value) {
    setBusyId(item.id);
    setError("");
    try {
      if (!(await confirmGuardar(`el precio de “${item.nombre}”`))) return;
      const updated = await actualizarServicio(item.id, { precio: value });
      setItems((prev) => prev.map((s) => (s.id === item.id ? { ...s, ...updated } : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el precio.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className={`${cardClass} space-y-4`}>
        <div>
          <h3 className="font-semibold text-aguara-ink">Servicios propios</h3>
          <p className="text-sm text-stone-500">
            Extras de esta clínica (no están en el catálogo general).
          </p>
        </div>
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!(await confirmGuardar(`el servicio propio “${nombre.trim()}”`))) return;
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
            Agregar propio
          </button>
          <input
            placeholder="Descripción"
            className={`${fieldClass} sm:col-span-4`}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </form>
        <ul className="divide-y divide-stone-100">
          {propios.length === 0 ? (
            <li className="py-2 text-sm text-stone-500">Sin servicios propios todavía.</li>
          ) : (
            propios.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-aguara-ink">
                    {item.nombre}
                    <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-900">
                      servicio propio
                    </span>
                    {item.activo === false ? (
                      <span className="ml-2 text-xs text-stone-400">(inactivo)</span>
                    ) : null}
                  </p>
                  {item.descripcion ? (
                    <p className="text-xs text-stone-500">{item.descripcion}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <span className="text-stone-500">$</span>
                    <input
                      type="number"
                      className="w-24 rounded-md border border-stone-300 px-2 py-1"
                      defaultValue={item.precio ?? ""}
                      disabled={busyId === item.id}
                      onBlur={(e) => {
                        const next = e.target.value;
                        const prev =
                          item.precio == null || item.precio === "" ? "" : String(item.precio);
                        if (next === prev) return;
                        guardarPrecio(item, next);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="text-aguara-orange underline text-sm"
                    onClick={() => toggleOfrece(item)}
                  >
                    {item.activo === false ? "Activar" : "Desactivar"}
                  </button>
                  <button
                    type="button"
                    className="text-stone-500 underline text-sm"
                    onClick={async () => {
                      if (!(await confirmEliminar(`el servicio propio “${item.nombre}”`))) return;
                      await eliminarServicio(item.id);
                      await reload();
                    }}
                  >
                    Quitar
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className={`${cardClass} space-y-4`}>
        <div>
          <h3 className="font-semibold text-aguara-ink">Servicios generales</h3>
          <p className="text-sm text-stone-500">
            Catálogo común a todas las clínicas. Activá solo los que ofrezcan en este local. La
            vacunación, si está activa, registra historial y recordatorio.
          </p>
        </div>
        <ul className="divide-y divide-stone-100">
          {generales.length === 0 ? (
            <li className="py-2 text-sm text-stone-500">
              Todavía no hay catálogo. Ejecutá{" "}
              <code className="text-xs">29_servicios_generales.sql</code> en Supabase.
            </li>
          ) : (
            generales.map((item) => {
              const ofrece = item.activo !== false;
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-aguara-ink">
                      {item.nombre}
                      <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                        general
                      </span>
                      {esServicioVacunacion(item) ? (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                          historial + recordatorio
                        </span>
                      ) : null}
                    </p>
                    {item.descripcion ? (
                      <p className="text-xs text-stone-500">{item.descripcion}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-stone-700">
                      <span className="text-stone-500">$</span>
                      <input
                        type="number"
                        className="w-24 rounded-md border border-stone-300 px-2 py-1"
                        defaultValue={item.precio ?? ""}
                        disabled={busyId === item.id}
                        onBlur={(e) => {
                          const next = e.target.value;
                          const prev =
                            item.precio == null || item.precio === ""
                              ? ""
                              : String(item.precio);
                          if (next === prev) return;
                          guardarPrecio(item, next);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => toggleOfrece(item)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                        ofrece
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {ofrece ? "Lo ofrecemos" : "No lo ofrecemos"}
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

function Horarios({ clinicaId }) {
  const [items, setItems] = useState([]);
  const [diaSemana, setDiaSemana] = useState("1");
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFin, setHoraFin] = useState("18:00");
  const [error, setError] = useState("");

  async function reload() {
    const horarios = await listarHorarios(clinicaId);
    setItems(horarios.filter((h) => !h.veterinario_id));
  }

  useEffect(() => {
    reload().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId]);

  return (
    <div className={`${cardClass} space-y-4`}>
      <div>
        <h3 className="font-semibold text-aguara-ink">Horario de apertura del local</h3>
        <p className="text-sm text-stone-500">
          Define cuándo está abierta la clínica. Los veterinarios cargan su propia agenda en su
          perfil, siempre dentro de este horario.
        </p>
      </div>
      <form
        className="grid gap-3 sm:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!(await confirmGuardar("el horario de apertura del local"))) return;
          setError("");
          try {
            await crearHorario(clinicaId, {
              diaSemana,
              horaInicio,
              horaFin,
              veterinarioId: null,
            });
            await reload();
          } catch (err) {
            setError(err.message);
          }
        }}
      >
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
        <button type="submit" className={primaryBtnClass}>
          Agregar
        </button>
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <ul className="space-y-2 text-sm">
        {items.length === 0 ? (
          <li className="text-stone-500">Todavía no cargaste la apertura del local.</li>
        ) : (
          items.map((slot) => (
            <li key={slot.id} className="flex justify-between gap-3">
              <span>
                <span className="font-medium text-aguara-ink">Apertura</span>
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
          e.stopPropagation();
          if (!(await confirmGuardar(`el producto “${nombre.trim()}”`))) return;
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
