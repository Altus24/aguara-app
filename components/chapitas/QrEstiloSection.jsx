'use client';

import { useEffect, useState } from 'react';
import { confirmAccion, confirmEliminar, confirmGuardar } from '@/lib/confirmAction';
import { generateChapitaQrSvg } from '@/lib/chapitas/chapitaQr';
import {
  DEFAULT_QR_ESTILO,
  NOMBRE_TAMANO_PX_MAX,
  NOMBRE_TAMANO_PX_MIN,
  QR_ECC_OPTIONS,
  QR_NOMBRE_POSICIONES,
  QR_TAMANO_OPTIONS,
  deleteQrPlantilla,
  getActivePlantillaId,
  loadQrEstilo,
  loadQrPlantillas,
  normalizeQrEstilo,
  saveQrEstilo,
  saveQrPlantilla,
  setActivePlantillaId,
} from '@/lib/chapitas/qrEstilo';

const PREVIEW_ID = 'preview-estilo';

const SUBTABS = [
  { id: 'editar', label: 'Editar' },
  { id: 'plantillas', label: 'Plantillas guardadas' },
];

export default function QrEstiloSection({ onSaved }) {
  const [subTab, setSubTab] = useState('editar');
  const [form, setForm] = useState(() => normalizeQrEstilo(DEFAULT_QR_ESTILO));
  const [plantillas, setPlantillas] = useState([]);
  const [activePlantillaId, setActiveId] = useState(null);
  const [editingPlantillaId, setEditingPlantillaId] = useState(null);
  const [nombrePlantilla, setNombrePlantilla] = useState('');
  const [previewSvg, setPreviewSvg] = useState('');
  const [previewLive, setPreviewLive] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const estilo = loadQrEstilo();
    setForm(estilo);
    setPlantillas(loadQrPlantillas());
    const activeId = getActivePlantillaId();
    setActiveId(activeId);
    if (activeId) {
      const active = loadQrPlantillas().find((p) => p.id === activeId);
      if (active) setNombrePlantilla(active.nombre);
    }
  }, []);

  useEffect(() => {
    if (!previewLive || subTab !== 'editar') return undefined;
    let cancelled = false;
    const estilo = normalizeQrEstilo(form);
    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const svg = await generateChapitaQrSvg(PREVIEW_ID, estilo);
        if (!cancelled) setPreviewSvg(svg);
      } catch {
        if (!cancelled) setPreviewSvg('');
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form, previewLive, subTab]);

  function refreshPlantillas() {
    setPlantillas(loadQrPlantillas());
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSavedMsg('');
    setErrorMsg('');
  }

  async function runPreview() {
    setPreviewLive(true);
    setPreviewLoading(true);
    setErrorMsg('');
    try {
      const svg = await generateChapitaQrSvg(PREVIEW_ID, normalizeQrEstilo(form));
      setPreviewSvg(svg);
    } catch {
      setPreviewSvg('');
      setErrorMsg('No se pudo generar la vista previa.');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSaveActivo(e) {
    e.preventDefault();
    if (!(await confirmGuardar('el estilo activo del QR'))) return;
    const next = saveQrEstilo(form);
    setForm(next);
    setSavedMsg('Estilo activo guardado. Los ZIP y descargas nuevas usarán estos valores.');
    onSaved?.(next);
  }

  function handleReset() {
    const next = saveQrEstilo(DEFAULT_QR_ESTILO);
    setForm(next);
    setActivePlantillaId(null);
    setActiveId(null);
    setEditingPlantillaId(null);
    setNombrePlantilla('');
    setSavedMsg('Estilo restablecido a los valores por defecto.');
    onSaved?.(next);
  }

  function handleAplicarPlantilla(plantilla) {
    const next = normalizeQrEstilo(plantilla.estilo);
    setForm(next);
    setActivePlantillaId(plantilla.id);
    setActiveId(plantilla.id);
    setEditingPlantillaId(null);
    setNombrePlantilla(plantilla.nombre);
    setSavedMsg(`Plantilla “${plantilla.nombre}” aplicada como estilo activo.`);
    setErrorMsg('');
    onSaved?.(saveQrEstilo(next));
  }

  function handleEditarPlantilla(plantilla) {
    const next = normalizeQrEstilo(plantilla.estilo);
    setForm(next);
    setEditingPlantillaId(plantilla.id);
    setActivePlantillaId(plantilla.id);
    setActiveId(plantilla.id);
    setNombrePlantilla(plantilla.nombre);
    setSubTab('editar');
    setPreviewLive(true);
    setSavedMsg(`Editando “${plantilla.nombre}”. Cambiá los valores y tocá “Guardar cambios”.`);
    setErrorMsg('');
  }

  function handleCancelarEdicion() {
    setEditingPlantillaId(null);
    setNombrePlantilla('');
    setSavedMsg('Edición cancelada.');
    setErrorMsg('');
    setSubTab('plantillas');
  }

  async function handleGuardarPlantilla() {
    const name = nombrePlantilla.trim();
    if (!name) {
      setErrorMsg('Indicá un nombre para la plantilla.');
      return;
    }

    const sameName = plantillas.find(
      (p) =>
        p.nombre.toLowerCase() === name.toLowerCase() &&
        p.id !== editingPlantillaId
    );

    if (sameName) {
      if (
        !(await confirmAccion(
          `Ya existe una plantilla llamada “${sameName.nombre}”. ¿Querés sobrescribirla?`,
        ))
      ) {
        return;
      }
      try {
        const saved = saveQrPlantilla(name, form, sameName.id);
        const nextEstilo = saveQrEstilo(form);
        refreshPlantillas();
        setActiveId(saved.id);
        setEditingPlantillaId(null);
        setNombrePlantilla('');
        setForm(nextEstilo);
        setSavedMsg(`Plantilla “${saved.nombre}” sobrescrita.`);
        setErrorMsg('');
        onSaved?.(nextEstilo);
        setSubTab('plantillas');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar la plantilla.');
      }
      return;
    }

    try {
      const saved = saveQrPlantilla(name, form, null);
      const nextEstilo = saveQrEstilo(form);
      refreshPlantillas();
      setActiveId(saved.id);
      setEditingPlantillaId(null);
      setNombrePlantilla('');
      setForm(nextEstilo);
      setSavedMsg(`Plantilla “${saved.nombre}” creada.`);
      setErrorMsg('');
      onSaved?.(nextEstilo);
      setSubTab('plantillas');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar la plantilla.');
    }
  }

  async function handleGuardarCambiosEdicion() {
    if (!editingPlantillaId) {
      setErrorMsg('No hay una plantilla en edición.');
      return;
    }
    const editing = plantillas.find((p) => p.id === editingPlantillaId);
    if (!editing) {
      setErrorMsg('La plantilla en edición ya no existe.');
      setEditingPlantillaId(null);
      return;
    }

    const name = nombrePlantilla.trim() || editing.nombre;
    const conflict = plantillas.find(
      (p) => p.id !== editingPlantillaId && p.nombre.toLowerCase() === name.toLowerCase()
    );
    if (conflict) {
      setErrorMsg(`Ya existe otra plantilla llamada “${conflict.nombre}”. Elegí otro nombre.`);
      return;
    }

    try {
      const saved = saveQrPlantilla(name, form, editingPlantillaId);
      const nextEstilo = saveQrEstilo(form);
      refreshPlantillas();
      setActiveId(saved.id);
      setEditingPlantillaId(null);
      setNombrePlantilla('');
      setForm(nextEstilo);
      setSavedMsg(`Cambios de “${saved.nombre}” guardados.`);
      setErrorMsg('');
      onSaved?.(nextEstilo);
      setSubTab('plantillas');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar los cambios.');
    }
  }

  async function handleEliminarPlantilla(id) {
    const item = plantillas.find((p) => p.id === id);
    if (!item) return;
    if (!(await confirmEliminar(`la plantilla “${item.nombre}”`))) return;
    const next = deleteQrPlantilla(id);
    setPlantillas(next);
    if (activePlantillaId === id) {
      setActiveId(null);
    }
    if (editingPlantillaId === id) {
      setEditingPlantillaId(null);
      setNombrePlantilla('');
    }
    setSavedMsg(`Plantilla “${item.nombre}” eliminada.`);
  }

  const estiloNorm = normalizeQrEstilo(form);
  const plantillaEnEdicion = plantillas.find((p) => p.id === editingPlantillaId);

  return (
    <div className="mb-10 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-blue-700">Personalizar QR</h2>
        <p className="text-sm text-gray-600">
          Definí el tamaño físico en cm, guardá plantillas con nombre y usá la vista previa en
          tiempo real antes de exportar.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUBTABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSubTab(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              subTab === item.id
                ? 'bg-blue-700 text-white'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            {item.id === 'plantillas'
              ? `${item.label} (${plantillas.length})`
              : item.label}
          </button>
        ))}
      </div>

      {savedMsg && subTab === 'plantillas' ? (
        <p className="text-sm text-green-700">{savedMsg}</p>
      ) : null}

      {subTab === 'plantillas' ? (
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-blue-700">Plantillas guardadas</h3>
              <p className="text-sm text-gray-600">
                Cada guardado con un nombre nuevo crea una plantilla aparte.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingPlantillaId(null);
                setNombrePlantilla('');
                setSubTab('editar');
              }}
              className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              Nueva desde el editor
            </button>
          </div>

          {plantillas.length === 0 ? (
            <p className="text-sm text-gray-500">
              Todavía no hay plantillas. Andá a <span className="font-medium">Editar</span>,
              configurá el QR y usá “Guardar como nueva”.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {plantillas.map((p) => {
                const e = normalizeQrEstilo(p.estilo);
                const isActive = activePlantillaId === p.id;
                const isEditing = editingPlantillaId === p.id;
                return (
                  <li
                    key={p.id}
                    className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between ${
                      isEditing || isActive ? 'bg-blue-50/60 -mx-2 px-2 rounded-md' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">
                        {p.nombre}
                        {isEditing ? (
                          <span className="ml-2 text-xs font-normal text-amber-700">
                            (editando)
                          </span>
                        ) : isActive ? (
                          <span className="ml-2 text-xs font-normal text-blue-700">
                            (estilo activo)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm text-gray-600">
                        {e.tamano_cm}×{e.tamano_cm} cm · nombre {e.nombre_posicion} · logo{' '}
                        {e.logo_porcentaje}% · ECC {e.complejidad}
                        {e.texto_marca ? ` · “${e.texto_marca}”` : ''}
                      </p>
                      {p.actualizado_en ? (
                        <p className="text-xs text-gray-400">
                          Actualizada{' '}
                          {new Date(p.actualizado_en).toLocaleString('es-AR')}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditarPlantilla(p)}
                        className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAplicarPlantilla(p)}
                        className="rounded-md border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Aplicar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminarPlantilla(p.id)}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <form
            onSubmit={handleSaveActivo}
            className="w-full space-y-5 rounded-lg bg-white p-6 shadow-md lg:max-h-[60vh] lg:min-w-0 lg:flex-1 lg:overflow-y-auto"
          >
            <div
              className={`rounded-md border p-3 space-y-3 ${
                plantillaEnEdicion
                  ? 'border-amber-200 bg-amber-50/70'
                  : 'border-blue-100 bg-blue-50/60'
              }`}
            >
              {plantillaEnEdicion ? (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      Editando plantilla
                    </p>
                    <p className="text-xs text-amber-800">
                      Original: {plantillaEnEdicion.nombre}. Podés renombrarla abajo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelarEdicion}
                    className="text-xs text-amber-900 underline"
                  >
                    Cancelar edición
                  </button>
                </div>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  {plantillaEnEdicion ? 'Nombre de la plantilla' : 'Nombre de la nueva plantilla'}
                </span>
                <input
                  type="text"
                  maxLength={60}
                  value={nombrePlantilla}
                  onChange={(e) => {
                    setNombrePlantilla(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Ej. Chapita 3 cm clásica"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {plantillaEnEdicion ? (
                  <button
                    type="button"
                    onClick={handleGuardarCambiosEdicion}
                    className="rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
                  >
                    Guardar cambios
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleGuardarPlantilla}
                  className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
                >
                  Guardar como nueva
                </button>
                <button
                  type="button"
                  onClick={runPreview}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-white"
                >
                  {previewLive ? 'Actualizar vista previa' : 'Vista previa'}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {plantillaEnEdicion
                  ? '“Guardar cambios” actualiza esta plantilla. “Guardar como nueva” crea otra sin tocar la original.'
                  : 'Desde “Plantillas guardadas” podés editar una existente con el botón Editar.'}
              </p>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-gray-700">Tamaño final</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {QR_TAMANO_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateField('tamano_cm', opt.cm)}
                    className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                      Number(form.tamano_cm) === opt.cm
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-gray-200 text-gray-800 hover:border-blue-200'
                    }`}
                  >
                    <span className="block font-medium">{opt.label}</span>
                    <span className="block text-xs text-gray-500">{opt.hint}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {estiloNorm.tamano_cm} × {estiloNorm.tamano_cm} cm · ≈ {estiloNorm.tamano_final} px
                a 300 DPI
              </p>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-gray-700">
                Posición del nombre
              </legend>
              <div className="flex flex-wrap gap-2">
                {QR_NOMBRE_POSICIONES.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateField('nombre_posicion', opt.id)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      form.nombre_posicion === opt.id
                        ? 'bg-blue-700 text-white'
                        : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Tamaño del nombre (px)
              </span>
              <input
                type="range"
                min={NOMBRE_TAMANO_PX_MIN}
                max={NOMBRE_TAMANO_PX_MAX}
                step={1}
                value={form.nombre_tamano ?? DEFAULT_QR_ESTILO.nombre_tamano}
                onChange={(e) => updateField('nombre_tamano', Number(e.target.value))}
                className="w-full accent-blue-700"
              />
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">{NOMBRE_TAMANO_PX_MIN}</span>
                <input
                  type="number"
                  min={NOMBRE_TAMANO_PX_MIN}
                  max={NOMBRE_TAMANO_PX_MAX}
                  value={form.nombre_tamano ?? DEFAULT_QR_ESTILO.nombre_tamano}
                  onChange={(e) => updateField('nombre_tamano', Number(e.target.value))}
                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
                <span className="text-xs text-gray-500">{NOMBRE_TAMANO_PX_MAX}</span>
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Tamaño del logo (% del QR)
              </span>
              <input
                type="range"
                min={8}
                max={40}
                step={1}
                value={form.logo_porcentaje ?? 20}
                onChange={(e) => updateField('logo_porcentaje', Number(e.target.value))}
                className="w-full accent-blue-700"
              />
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">8%</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={8}
                    max={40}
                    value={form.logo_porcentaje ?? 20}
                    onChange={(e) => updateField('logo_porcentaje', Number(e.target.value))}
                    className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                  <span className="text-sm text-gray-600">%</span>
                </div>
                <span className="text-xs text-gray-500">40%</span>
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Texto de marca</span>
              <input
                type="text"
                maxLength={40}
                value={form.texto_marca}
                onChange={(e) => updateField('texto_marca', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-gray-700">
                Complejidad del patrón
              </legend>
              <div className="space-y-2">
                {QR_ECC_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm transition ${
                      form.complejidad === opt.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="complejidad"
                      value={opt.id}
                      checked={form.complejidad === opt.id}
                      onChange={() => updateField('complejidad', opt.id)}
                      className="mt-1 accent-blue-700"
                    />
                    <span>
                      <span className="font-medium text-gray-800">{opt.label}</span>
                      <span className="block text-xs text-gray-500">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                Usar como estilo activo
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Restablecer
              </button>
            </div>
            {savedMsg ? <p className="text-sm text-green-700">{savedMsg}</p> : null}
            {errorMsg ? <p className="text-sm text-red-600">{errorMsg}</p> : null}
          </form>

          <div className="flex w-full flex-col rounded-lg bg-white p-4 shadow-md lg:min-w-0 lg:w-[60vw] xl:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-800">Vista previa</h3>
              <button
                type="button"
                onClick={runPreview}
                className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
              >
                {previewLive ? 'Actualizar' : 'Vista previa'}
              </button>
            </div>

            {!previewLive && !previewSvg ? (
              <div className="flex h-[60vh] min-h-[60vh] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
                <p className="text-sm text-gray-500">
                  Tocá <span className="font-medium text-gray-700">Vista previa</span> para ver el
                  QR. Después se actualiza en tiempo real al cambiar valores.
                </p>
                <button
                  type="button"
                  onClick={runPreview}
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                >
                  Vista previa
                </button>
              </div>
            ) : (
              <div className="flex h-[60vh] min-h-[60vh] items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50 p-3">
                {previewLoading && !previewSvg ? (
                  <p className="text-sm text-gray-500">Generando…</p>
                ) : previewSvg ? (
                  <div
                    className="flex h-[90%] w-[90%] max-h-[90%] max-w-[90%] items-center justify-center [&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-full [&_svg]:object-contain"
                    dangerouslySetInnerHTML={{ __html: previewSvg }}
                  />
                ) : (
                  <p className="text-sm text-gray-500">No se pudo generar la vista previa.</p>
                )}
              </div>
            )}

            <p className="mt-3 text-xs text-gray-500">
              {estiloNorm.tamano_cm}×{estiloNorm.tamano_cm} cm · nombre {form.nombre_posicion} ·
              logo {estiloNorm.logo_porcentaje}% · ECC {form.complejidad}
              {previewLive ? ' · actualización en vivo' : ''}
              {previewLoading ? ' · regenerando…' : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
