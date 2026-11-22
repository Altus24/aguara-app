"use client";

import { useState } from "react";

import { razasParaEspecie } from "@/lib/chapitas/razas";
import { confirmGuardar } from "@/lib/confirmAction";

export const ESPECIES_MASCOTA = ["Perro", "Gato"];
export const SEXOS_MASCOTA = ["Macho", "Hembra"];
export const TEMPERAMENTOS_MASCOTA = [
  "Agresivo",
  "Asustadizo",
  "Nervioso",
  "Tranquilo",
  "Amigable",
];

export const EMPTY_PET_FORM = {
  nombre_mascota: "",
  especie: "Perro",
  raza: "",
  sexo: "Macho",
  castrado: "",
  temperamento: "",
  fecha_nacimiento: "",
  peso: "",
  nro_chip: "",
  enfermedad: "",
  medicacion: "",
  datos_adicionales: "",
  clinica_cabecera_id: "",
  clinica_ref_nombre: "",
  clinica_ref_direccion: "",
  clinica_ref_telefono: "",
};

export const CLINICA_AGREGAR_VALUE = "__agregar__";

const defaultFieldClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500";

/**
 * Campos de mascota alineados al formulario de activación de chapita.
 */
export default function MascotaRegistroFields({
  form,
  onChange,
  fotoInputId = "foto",
  preview = null,
  onPhoto,
  fieldClass = defaultFieldClass,
  showTitle = true,
  nombreKey = "nombre_mascota",
  clinicas = null,
  onGuardarClinicaRef = null,
}) {
  const [clinicaRefMsg, setClinicaRefMsg] = useState("");
  const [guardandoClinicaRef, setGuardandoClinicaRef] = useState(false);
  const [showClinicaRefModal, setShowClinicaRefModal] = useState(false);
  const [draftRef, setDraftRef] = useState({
    nombre: "",
    direccion: "",
    telefono: "",
  });

  function set(name, value) {
    onChange(name, value);
  }

  const nombre = form[nombreKey] ?? form.nombre_mascota ?? "";
  const especieActual = form.especie || "Perro";
  const razas = razasParaEspecie(especieActual);
  const razaActual = form.raza || "";
  const razaFueraDeLista = Boolean(razaActual) && !razas.includes(razaActual);
  const tieneClinicaRef = Boolean(String(form.clinica_ref_nombre || "").trim());
  const clinicaSelectValue = form.clinica_cabecera_id
    ? form.clinica_cabecera_id
    : tieneClinicaRef
      ? CLINICA_AGREGAR_VALUE
      : "";

  function openClinicaRefModal() {
    setDraftRef({
      nombre: form.clinica_ref_nombre || "",
      direccion: form.clinica_ref_direccion || "",
      telefono: form.clinica_ref_telefono || "",
    });
    setClinicaRefMsg("");
    setShowClinicaRefModal(true);
  }

  function handleClinicaSelectChange(value) {
    if (value === CLINICA_AGREGAR_VALUE) {
      set("clinica_cabecera_id", "");
      openClinicaRefModal();
      return;
    }
    setShowClinicaRefModal(false);
    set("clinica_cabecera_id", value);
    if (value) {
      set("clinica_ref_nombre", "");
      set("clinica_ref_direccion", "");
      set("clinica_ref_telefono", "");
      setClinicaRefMsg("");
    }
  }

  async function handleGuardarClinicaRef() {
    const nombreClinica = String(draftRef.nombre || "").trim();
    if (!nombreClinica) {
      setClinicaRefMsg("Indicá al menos el nombre de la clínica.");
      return;
    }
    if (!(await confirmGuardar(`la clínica de referencia “${nombreClinica}”`))) return;
    setGuardandoClinicaRef(true);
    setClinicaRefMsg("");
    const payload = {
      clinica_ref_nombre: nombreClinica,
      clinica_ref_direccion: String(draftRef.direccion || "").trim(),
      clinica_ref_telefono: String(draftRef.telefono || "").trim(),
    };
    try {
      set("clinica_cabecera_id", "");
      set("clinica_ref_nombre", payload.clinica_ref_nombre);
      set("clinica_ref_direccion", payload.clinica_ref_direccion);
      set("clinica_ref_telefono", payload.clinica_ref_telefono);
      if (typeof onGuardarClinicaRef === "function") {
        await onGuardarClinicaRef(payload);
      }
      setClinicaRefMsg("Clínica de referencia guardada.");
      setShowClinicaRefModal(false);
    } catch (err) {
      setClinicaRefMsg(
        err instanceof Error ? err.message : "No se pudo guardar la clínica.",
      );
    } finally {
      setGuardandoClinicaRef(false);
    }
  }

  return (
    <div className="space-y-4">
      {showTitle ? (
        <h3 className="border-b border-stone-200 pb-2 text-base font-semibold text-stone-900">
          Datos del animal
        </h3>
      ) : null}

      <div>
        <label htmlFor={`${fotoInputId}-nombre`} className="mb-1 block text-sm font-medium text-gray-700">
          Nombre *
        </label>
        <input
          id={`${fotoInputId}-nombre`}
          type="text"
          required
          value={nombre}
          onChange={(e) => set(nombreKey, e.target.value)}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor={fotoInputId} className="mb-1 block text-sm font-medium text-gray-700">
          Foto
        </label>
        <input
          id={fotoInputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onPhoto}
          className={`${fieldClass} py-2 file:mr-3 file:rounded-full file:border-0 file:bg-orange-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-orange-800`}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Vista previa" className="mt-3 size-24 rounded-full object-cover" />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${fotoInputId}-especie`} className="mb-1 block text-sm font-medium text-gray-700">
            Especie *
          </label>
          <select
            id={`${fotoInputId}-especie`}
            value={especieActual}
            onChange={(e) => {
              const next = e.target.value;
              set("especie", next);
              const nextRazas = razasParaEspecie(next);
              if (razaActual && !nextRazas.includes(razaActual)) {
                set("raza", "");
              }
            }}
            className={fieldClass}
          >
            {ESPECIES_MASCOTA.map((especie) => (
              <option key={especie} value={especie}>
                {especie}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${fotoInputId}-raza`} className="mb-1 block text-sm font-medium text-gray-700">
            Raza
          </label>
          <select
            id={`${fotoInputId}-raza`}
            value={razaActual}
            onChange={(e) => set("raza", e.target.value)}
            className={fieldClass}
          >
            <option value="">Seleccionar…</option>
            {razaFueraDeLista ? (
              <option value={razaActual}>{razaActual}</option>
            ) : null}
            {razas.map((raza) => (
              <option key={raza} value={raza}>
                {raza}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${fotoInputId}-sexo`} className="mb-1 block text-sm font-medium text-gray-700">
            Sexo *
          </label>
          <select
            id={`${fotoInputId}-sexo`}
            value={form.sexo || "Macho"}
            onChange={(e) => set("sexo", e.target.value)}
            className={fieldClass}
          >
            {SEXOS_MASCOTA.map((sexo) => (
              <option key={sexo} value={sexo}>
                {sexo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${fotoInputId}-castrado`} className="mb-1 block text-sm font-medium text-gray-700">
            Castrado *
          </label>
          <select
            id={`${fotoInputId}-castrado`}
            value={form.castrado || ""}
            onChange={(e) => set("castrado", e.target.value)}
            required
            className={fieldClass}
          >
            <option value="">Elegí una opción</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
            <option value="ns">No lo sé</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor={`${fotoInputId}-temperamento`} className="mb-1 block text-sm font-medium text-gray-700">
          Temperamento *
        </label>
        <select
          id={`${fotoInputId}-temperamento`}
          value={form.temperamento || ""}
          onChange={(e) => set("temperamento", e.target.value)}
          required
          className={fieldClass}
        >
          <option value="">Elegí una opción</option>
          {TEMPERAMENTOS_MASCOTA.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${fotoInputId}-fecha_nacimiento`}
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Fecha de nacimiento
          </label>
          <input
            id={`${fotoInputId}-fecha_nacimiento`}
            type="date"
            value={form.fecha_nacimiento || ""}
            onChange={(e) => set("fecha_nacimiento", e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${fotoInputId}-peso`} className="mb-1 block text-sm font-medium text-gray-700">
            Peso (kg)
          </label>
          <input
            id={`${fotoInputId}-peso`}
            type="number"
            step="0.1"
            min="0"
            value={form.peso || ""}
            onChange={(e) => set("peso", e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${fotoInputId}-nro_chip`} className="mb-1 block text-sm font-medium text-gray-700">
          N° de chip
        </label>
        <input
          id={`${fotoInputId}-nro_chip`}
          type="text"
          value={form.nro_chip || ""}
          onChange={(e) => set("nro_chip", e.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
        <p className="text-sm font-medium text-stone-800">
          Clínica de cabecera{" "}
          <span className="font-normal text-stone-500">(opcional)</span>
        </p>
        <p className="text-xs text-stone-500">
          Elegí una clínica del sistema o usá “Agregar clínica” para cargar una de
          referencia.
        </p>

        <div>
          <label
            htmlFor={`${fotoInputId}-clinica_cabecera`}
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Clínica
          </label>
          <select
            id={`${fotoInputId}-clinica_cabecera`}
            value={clinicaSelectValue}
            onChange={(e) => handleClinicaSelectChange(e.target.value)}
            className={fieldClass}
          >
            {!form.clinica_cabecera_id && !tieneClinicaRef ? (
              <option value="">Elegí una clínica</option>
            ) : null}
            <option value={CLINICA_AGREGAR_VALUE}>Agregar clínica</option>
            {Array.isArray(clinicas)
              ? clinicas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                    {c.ciudad ? ` · ${c.ciudad}` : ""}
                  </option>
                ))
              : null}
          </select>
        </div>

        {tieneClinicaRef && !form.clinica_cabecera_id ? (
          <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">
            <p className="font-medium">{form.clinica_ref_nombre}</p>
            {form.clinica_ref_direccion ? (
              <p className="text-stone-500">{form.clinica_ref_direccion}</p>
            ) : null}
            {form.clinica_ref_telefono ? (
              <p className="text-stone-500">Tel. {form.clinica_ref_telefono}</p>
            ) : null}
            <button
              type="button"
              className="mt-2 text-sm font-medium text-orange-700 hover:underline"
              onClick={openClinicaRefModal}
            >
              Editar clínica de referencia
            </button>
          </div>
        ) : null}

        {clinicaRefMsg && !showClinicaRefModal ? (
          <p
            className={`text-sm ${
              /guardada/i.test(clinicaRefMsg) ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {clinicaRefMsg}
          </p>
        ) : null}
      </div>

      {showClinicaRefModal ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${fotoInputId}-clinica-ref-title`}
          onClick={() => setShowClinicaRefModal(false)}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id={`${fotoInputId}-clinica-ref-title`}
              className="text-lg font-semibold text-stone-900"
            >
              Clínica de referencia
            </h2>
            <p className="text-sm text-stone-500">
              Aunque no esté en Aguará, queda como referencia de la mascota.
            </p>
            <div>
              <label
                htmlFor={`${fotoInputId}-clinica_ref_nombre`}
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Nombre de la clínica
              </label>
              <input
                id={`${fotoInputId}-clinica_ref_nombre`}
                type="text"
                autoFocus
                value={draftRef.nombre}
                onChange={(e) => {
                  setDraftRef((d) => ({ ...d, nombre: e.target.value }));
                  setClinicaRefMsg("");
                }}
                className={fieldClass}
                placeholder="Ej. Veterinaria San Martín"
              />
            </div>
            <div>
              <label
                htmlFor={`${fotoInputId}-clinica_ref_direccion`}
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Dirección
              </label>
              <input
                id={`${fotoInputId}-clinica_ref_direccion`}
                type="text"
                value={draftRef.direccion}
                onChange={(e) => {
                  setDraftRef((d) => ({ ...d, direccion: e.target.value }));
                  setClinicaRefMsg("");
                }}
                className={fieldClass}
                placeholder="Calle, número, localidad"
              />
            </div>
            <div>
              <label
                htmlFor={`${fotoInputId}-clinica_ref_telefono`}
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Teléfono de contacto
              </label>
              <input
                id={`${fotoInputId}-clinica_ref_telefono`}
                type="tel"
                value={draftRef.telefono}
                onChange={(e) => {
                  setDraftRef((d) => ({ ...d, telefono: e.target.value }));
                  setClinicaRefMsg("");
                }}
                className={fieldClass}
                placeholder="Ej. 261 555-1234"
              />
            </div>
            {clinicaRefMsg ? (
              <p
                className={`text-sm ${
                  /guardada/i.test(clinicaRefMsg)
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}
              >
                {clinicaRefMsg}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                onClick={() => setShowClinicaRefModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoClinicaRef}
                onClick={handleGuardarClinicaRef}
                className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
              >
                {guardandoClinicaRef ? "Guardando…" : "Guardar clínica"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <label htmlFor={`${fotoInputId}-enfermedad`} className="mb-1 block text-sm font-medium text-gray-700">
          ¿Posee alguna enfermedad? ¿Cuál?
        </label>
        <textarea
          id={`${fotoInputId}-enfermedad`}
          rows={2}
          value={form.enfermedad || ""}
          onChange={(e) => set("enfermedad", e.target.value)}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor={`${fotoInputId}-medicacion`} className="mb-1 block text-sm font-medium text-gray-700">
          ¿Toma alguna medicación?
        </label>
        <textarea
          id={`${fotoInputId}-medicacion`}
          rows={2}
          value={form.medicacion || ""}
          onChange={(e) => set("medicacion", e.target.value)}
          className={fieldClass}
        />
      </div>

      <div>
        <label
          htmlFor={`${fotoInputId}-datos_adicionales`}
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Datos adicionales
        </label>
        <textarea
          id={`${fotoInputId}-datos_adicionales`}
          rows={4}
          value={form.datos_adicionales || ""}
          onChange={(e) => set("datos_adicionales", e.target.value)}
          className={fieldClass}
        />
      </div>
    </div>
  );
}

export function validateMascotaRegistroForm(form, { nombreKey = "nombre_mascota" } = {}) {
  const nombre = String(form[nombreKey] ?? form.nombre_mascota ?? "").trim();
  if (!nombre || !form.sexo || form.castrado === "" || !form.temperamento) {
    return "Completá los campos obligatorios de la mascota.";
  }
  return "";
}
