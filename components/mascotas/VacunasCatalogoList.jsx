"use client";

import { useMemo, useState } from "react";

import {
  catalogoVacunasConEstado,
  proximaFechaDesdeAplicacion,
} from "@/lib/chapitas/vacunas";
import { confirmGuardar } from "@/lib/confirmAction";

/**
 * Lista compacta del catálogo de vacunas con vencimiento
 * y un solo botón para actualizar/cargar la fecha de colocación.
 */
export default function VacunasCatalogoList({
  especie,
  vacunas = [],
  formatDate,
  fieldClass,
  primaryBtnClass,
  secondaryBtnClass,
  canUpdateVacuna = () => true,
  onRegistrar,
  onActualizarFecha,
  busy = false,
}) {
  const filas = useMemo(
    () => catalogoVacunasConEstado(especie, vacunas),
    [especie, vacunas],
  );
  const [editNombre, setEditNombre] = useState(null);
  const [editFecha, setEditFecha] = useState("");
  const [localBusy, setLocalBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const trabajando = busy || localBusy;

  async function handleGuardar(fila) {
    if (!editFecha) {
      setError("Indicá la fecha de colocación.");
      return;
    }
    if (!(await confirmGuardar(`la fecha de “${fila.nombre}”`))) return;
    setLocalBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        fecha: editFecha,
        proxima_fecha: proximaFechaDesdeAplicacion(editFecha),
      };
      const ultima = fila.ultima;
      if (ultima && canUpdateVacuna(ultima)) {
        await onActualizarFecha(ultima, payload);
      } else {
        await onRegistrar({ nombre: fila.nombre, ...payload });
      }
      setEditNombre(null);
      setMessage(`Fecha de ${fila.nombre} actualizada.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la fecha.");
    } finally {
      setLocalBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-stone-100 rounded-xl border border-stone-100 bg-white">
        {filas.map((fila) => {
          const ultima = fila.ultima;
          const editing = editNombre === fila.nombre;

          return (
            <li key={fila.nombre} className="px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 text-sm text-stone-700">
                  <span className="font-semibold text-aguara-ink">{fila.nombre}</span>
                  {fila.vencida ? (
                    <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800">
                      Vencida
                    </span>
                  ) : null}
                  <span className="text-stone-400"> · </span>
                  {ultima ? (
                    <>
                      <span>{formatDate(ultima.fecha) || "—"}</span>
                      <span className="text-stone-400"> · vence </span>
                      <span className={fila.vencida ? "font-medium text-red-700" : ""}>
                        {formatDate(fila.vencimiento) || "—"}
                      </span>
                    </>
                  ) : (
                    <span className="text-stone-400">Sin colocar</span>
                  )}
                </p>
                {!editing ? (
                  <button
                    type="button"
                    className="inline-flex h-7 shrink-0 items-center rounded-full border border-stone-300 bg-white px-2.5 text-[11px] font-medium text-stone-700 hover:border-stone-400 disabled:opacity-60"
                    disabled={trabajando}
                    onClick={() => {
                      setEditNombre(fila.nombre);
                      setEditFecha(
                        ultima?.fecha
                          ? String(ultima.fecha).slice(0, 10)
                          : new Date().toISOString().slice(0, 10),
                      );
                      setError("");
                      setMessage("");
                    }}
                  >
                    Actualizar fecha
                  </button>
                ) : null}
              </div>

              {editing ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    aria-label={`Fecha de ${fila.nombre}`}
                    className={`${fieldClass} max-w-[11rem] py-1.5 text-sm`}
                    value={editFecha}
                    onChange={(e) => setEditFecha(e.target.value)}
                  />
                  <button
                    type="button"
                    className={`${primaryBtnClass} h-8 px-3 text-xs`}
                    disabled={trabajando}
                    onClick={() => handleGuardar(fila)}
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    className={`${secondaryBtnClass} h-8 px-3 text-xs`}
                    disabled={trabajando}
                    onClick={() => setEditNombre(null)}
                  >
                    Cancelar
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
    </div>
  );
}
