"use client";

import { useEffect, useState } from "react";

import { cardClass, formatDate, secondaryBtnClass } from "@/components/tutor/ui";
import { confirmAccion } from "@/lib/confirmAction";
import { listarPermisosHcTutor, revocarCompartirHcTutor } from "@/lib/chapitas/tutorPortal";

export default function PermisosSection({ tutor }) {
  const [permisos, setPermisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revokingId, setRevokingId] = useState("");
  const [expandido, setExpandido] = useState(false);

  const permisosVisibles = expandido ? permisos : permisos.slice(0, 1);
  const permisosOcultos = Math.max(0, permisos.length - 1);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      setPermisos(await listarPermisosHcTutor(tutor.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los permisos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const perms = await listarPermisosHcTutor(tutor.id);
        if (!cancelled) setPermisos(perms);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar los permisos.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tutor.id]);

  async function handleRevocar(permiso) {
    const clinicaLabel = permiso.clinicas?.nombre || "esta clínica";
    if (
      !(await confirmAccion(
        `¿Quitar el permiso de ${clinicaLabel} para ver tu historial clínico completo? La historia que esa clínica cargó no se borra: solo deja de ver lo de otras clínicas y tus datos compartidos.`,
      ))
    ) {
      return;
    }
    setRevokingId(permiso.id);
    setError("");
    setMessage("");
    try {
      await revocarCompartirHcTutor(tutor.id, permiso.id);
      setMessage(`Permiso quitado a ${clinicaLabel}. Su historial propio se conserva.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar el permiso.");
    } finally {
      setRevokingId("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-aguara-ink">Permisos</h2>
        <p className="text-sm text-stone-500">
          Clínicas autorizadas a ver tu historia clínica completa
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <div className={cardClass}>
        <h3 className="font-semibold text-aguara-ink">Permisos para compartir historial</h3>
        <p className="mt-1 text-sm text-stone-500">
          Clínicas que autorizaste a ver tu historia clínica completa. Podés quitar el permiso
          cuando quieras: no se borra lo que esa clínica registró.
        </p>
        {loading ? (
          <p className="mt-3 text-sm text-stone-500">Cargando permisos…</p>
        ) : permisos.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">
            Ninguna clínica tiene permiso activo. Cuando aceptes una solicitud (en Perfil), aparece
            acá.
          </p>
        ) : (
          <div className="mt-3">
            <ul className="divide-y divide-stone-100">
              {permisosVisibles.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium text-aguara-ink">
                      {p.clinicas?.nombre || "Clínica"}
                      {p.clinicas?.ciudad ? ` · ${p.clinicas.ciudad}` : ""}
                    </p>
                    <p className="text-sm text-stone-500">
                      {p.mascota_nombre
                        ? `Mascota autorizada: ${p.mascota_nombre}`
                        : "Perfil / historial autorizado"}
                      {p.resuelto_en
                        ? ` · desde ${formatDate(String(p.resuelto_en).slice(0, 10))}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={secondaryBtnClass}
                    disabled={Boolean(revokingId)}
                    onClick={() => handleRevocar(p)}
                  >
                    {revokingId === p.id ? "…" : "Quitar permiso"}
                  </button>
                </li>
              ))}
            </ul>
            {permisosOcultos > 0 ? (
              <button
                type="button"
                className="mt-2 text-sm font-medium text-aguara-orange hover:underline"
                onClick={() => setExpandido((v) => !v)}
              >
                {expandido
                  ? "Ver menos"
                  : `Ver más (${permisosOcultos} anterior${permisosOcultos === 1 ? "" : "es"})`}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
