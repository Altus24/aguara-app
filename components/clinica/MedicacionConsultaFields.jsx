"use client";

import { emptyMedicacionRow } from "@/lib/chapitas/medicacionConsulta";
import { secondaryBtnClass } from "@/components/clinica/ui";

/**
 * Filas de medicación para HC: medicamento, dosis, tiempo, indicaciones.
 */
export default function MedicacionConsultaFields({ rows, onChange, fieldClass }) {
  const list = rows?.length ? rows : [emptyMedicacionRow()];

  function updateRow(index, key, value) {
    const next = list.map((row, i) => (i === index ? { ...row, [key]: value } : row));
    onChange?.(next);
  }

  function addRow() {
    onChange?.([...list, emptyMedicacionRow()]);
  }

  function removeRow(index) {
    if (list.length <= 1) {
      onChange?.([emptyMedicacionRow()]);
      return;
    }
    onChange?.(list.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {list.map((row, index) => (
        <div
          key={`med-row-${index}`}
          className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-stone-600">Medicamento {index + 1}</p>
            <div className="flex gap-2">
              {index === list.length - 1 ? (
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 bg-white text-lg font-semibold leading-none text-aguara-ink hover:border-aguara-orange"
                  aria-label="Agregar medicamento"
                  onClick={addRow}
                >
                  +
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 bg-white text-lg font-semibold leading-none text-stone-600 hover:border-red-300 hover:text-red-700"
                aria-label={`Quitar medicamento ${index + 1}`}
                onClick={() => removeRow(index)}
              >
                −
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs text-stone-500 sm:col-span-2">
              Medicamento
              <input
                className={`${fieldClass} mt-1`}
                value={row.medicamento}
                onChange={(e) => updateRow(index, "medicamento", e.target.value)}
                placeholder="Ej. Prednisolona 20 mg"
              />
            </label>
            <label className="block text-xs text-stone-500">
              Dosis
              <input
                className={`${fieldClass} mt-1`}
                value={row.dosis}
                onChange={(e) => updateRow(index, "dosis", e.target.value)}
                placeholder="Ej. 1 comprimido por día"
              />
            </label>
            <label className="block text-xs text-stone-500">
              Tiempo
              <input
                className={`${fieldClass} mt-1`}
                value={row.tiempo}
                onChange={(e) => updateRow(index, "tiempo", e.target.value)}
                placeholder="Ej. 10 días"
              />
            </label>
            <label className="block text-xs text-stone-500 sm:col-span-2">
              Indicaciones
              <textarea
                rows={2}
                className={`${fieldClass} mt-1`}
                value={row.indicaciones}
                onChange={(e) => updateRow(index, "indicaciones", e.target.value)}
                placeholder="Indicaciones adicionales"
              />
            </label>
          </div>
        </div>
      ))}
      {list.length > 0 && list.length < 12 ? (
        <button type="button" className={secondaryBtnClass} onClick={addRow}>
          + Agregar medicamento
        </button>
      ) : null}
    </div>
  );
}
