"use client";

import { useEffect, useMemo, useState } from "react";

import RecetaDocumento from "@/components/clinica/RecetaDocumento";
import {
  Field,
  cardClass,
  fieldClass,
  formatDate,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/clinica/ui";
import { confirmGuardar } from "@/lib/confirmAction";
import { actualizarClinica } from "@/lib/chapitas/clinicas";
import {
  RECETA_CONFIG_DEFAULTS,
  normalizeRecetaConfig,
  serializeRecetaConfig,
} from "@/lib/chapitas/recetaConfig";

const LOGO_OPTIONS = [
  { value: 80, label: "Chico" },
  { value: 110, label: "Mediano" },
  { value: 140, label: "Grande" },
  { value: 180, label: "Muy grande" },
];

const PREVIEW_PACIENTE = {
  nombre: "Firulais",
  fecha_nacimiento: "2020-03-15",
  sexo: "Macho",
  raza: "Mestizo",
};

const PREVIEW_CLIENTE = {
  nombre_completo: "Ana Pérez",
  direccion: "San Martín 123",
  dni: "30111222",
};

const PREVIEW_MEDICACION = JSON.stringify([
  {
    medicamento: "Prednisolona",
    dosis: "20 mg",
    tiempo: "1 vez al día, por 10 días",
    indicaciones: "Dar con comida",
  },
]);

export default function RecetaConfigPanel({ clinica, onSaved }) {
  const [form, setForm] = useState(() => normalizeRecetaConfig(clinica?.receta_config));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(normalizeRecetaConfig(clinica?.receta_config));
    setMessage("");
    setError("");
  }, [clinica?.id, clinica?.receta_config]);

  const previewClinica = useMemo(
    () => ({
      ...clinica,
      receta_config: form,
    }),
    [clinica, form],
  );

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!(await confirmGuardar("la personalización de la receta"))) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await actualizarClinica(clinica.id, {
        receta_config: serializeRecetaConfig(form),
      });
      setForm(normalizeRecetaConfig(updated.receta_config));
      onSaved?.(updated);
      setMessage("Personalización de receta guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className={`${cardClass} space-y-4`}>
        <div>
          <h3 className="font-semibold text-aguara-ink">Personalización de receta</h3>
          <p className="mt-1 text-sm text-stone-500">
            Definí el membrete de las recetas JPEG. El logo y el teléfono se toman del perfil de
            la clínica.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Color de acento" id="receta-color">
            <div className="flex items-center gap-2">
              <input
                id="receta-color"
                type="color"
                className="h-10 w-14 cursor-pointer rounded border border-stone-200 bg-white p-1"
                value={form.color_acento}
                onChange={(e) => setField("color_acento", e.target.value)}
              />
              <input
                type="text"
                className={fieldClass}
                value={form.color_acento}
                onChange={(e) => setField("color_acento", e.target.value)}
                placeholder="#2f6fed"
              />
            </div>
          </Field>

          <Field label="Tamaño del logo" id="receta-logo-size">
            <select
              id="receta-logo-size"
              className={fieldClass}
              value={form.logo_tamano}
              disabled={!form.mostrar_logo}
              onChange={(e) => setField("logo_tamano", Number(e.target.value))}
            >
              {LOGO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.value}px)
                </option>
              ))}
            </select>
          </Field>

          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.mostrar_logo}
              onChange={(e) => setField("mostrar_logo", e.target.checked)}
            />
            Mostrar logo
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.mostrar_telefono}
              onChange={(e) => setField("mostrar_telefono", e.target.checked)}
            />
            Mostrar teléfono
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.mostrar_nombre_clinica}
              onChange={(e) => setField("mostrar_nombre_clinica", e.target.checked)}
            />
            Mostrar nombre de la clínica
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.mostrar_direccion}
              onChange={(e) => setField("mostrar_direccion", e.target.checked)}
            />
            Mostrar dirección
          </label>

          <Field label="Etiqueta bajo la firma" id="receta-etiqueta">
            <input
              id="receta-etiqueta"
              className={fieldClass}
              value={form.etiqueta_profesional}
              onChange={(e) => setField("etiqueta_profesional", e.target.value)}
              placeholder="Veterinaria"
            />
          </Field>

          <Field label="Texto de pie (opcional)" id="receta-pie" className="sm:col-span-2">
            <textarea
              id="receta-pie"
              rows={2}
              className={fieldClass}
              value={form.texto_pie}
              onChange={(e) => setField("texto_pie", e.target.value)}
              placeholder="Ej.: Receta válida por 30 días. Conservar fuera del alcance de niños."
              maxLength={280}
            />
            <p className="mt-1 text-xs text-stone-400">{form.texto_pie.length}/280</p>
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className={primaryBtnClass}>
            {saving ? "Guardando…" : "Guardar personalización"}
          </button>
          <button
            type="button"
            className={secondaryBtnClass}
            disabled={saving}
            onClick={() => {
              setForm({ ...RECETA_CONFIG_DEFAULTS });
              setMessage("");
              setError("");
            }}
          >
            Restaurar valores por defecto
          </button>
        </div>

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      </form>

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Vista previa</h3>
        <p className="mt-1 text-sm text-stone-500">
          Ejemplo con datos ficticios. Los cambios se ven al instante; guardá para aplicarlos a las
          recetas reales.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl bg-stone-100 p-3 sm:p-5">
          <div
            className="mx-auto origin-top"
            style={{ width: 794, transform: "scale(0.72)", transformOrigin: "top center" }}
          >
            <div className="shadow-md" style={{ width: 794 }}>
              <RecetaDocumento
                clinica={previewClinica}
                paciente={PREVIEW_PACIENTE}
                cliente={PREVIEW_CLIENTE}
                medicacion={PREVIEW_MEDICACION}
                diagnostico=""
                firmaImagen={null}
                firmadoPor="Dra. Ejemplo · Mat. 12345"
                fechaHoy={formatDate(new Date())}
                config={form}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
