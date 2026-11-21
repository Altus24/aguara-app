"use client";

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
};

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
}) {
  function set(name, value) {
    onChange(name, value);
  }

  const nombre = form[nombreKey] ?? form.nombre_mascota ?? "";

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
            value={form.especie || "Perro"}
            onChange={(e) => set("especie", e.target.value)}
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
          <input
            id={`${fotoInputId}-raza`}
            type="text"
            value={form.raza || ""}
            onChange={(e) => set("raza", e.target.value)}
            className={fieldClass}
          />
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

      {Array.isArray(clinicas) ? (
        <div>
          <label
            htmlFor={`${fotoInputId}-clinica_cabecera`}
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Clínica de cabecera{" "}
            <span className="font-normal text-stone-500">(opcional)</span>
          </label>
          <select
            id={`${fotoInputId}-clinica_cabecera`}
            value={form.clinica_cabecera_id || ""}
            onChange={(e) => set("clinica_cabecera_id", e.target.value)}
            className={fieldClass}
          >
            <option value="">Sin clínica de cabecera</option>
            {clinicas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.ciudad ? ` · ${c.ciudad}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-stone-500">
            Preferida para turnos y seguimiento de esta mascota.
          </p>
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
