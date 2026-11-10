"use client";

import { useEffect, useState } from "react";

import {
  cardClass,
  fieldClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/clinica/ui";
import {
  listarDirectorioTutores,
  obtenerPerfilTutorCompartido,
  solicitarCompartirPerfilTutor,
} from "@/lib/chapitas/clinicaOps";

export default function TutoresDirectorySection({ clinicaId, clinicaNombre }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [perfil, setPerfil] = useState(null);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      setItems(await listarDirectorioTutores(clinicaId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el directorio.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicaId]);

  const filtered = items.filter((t) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    if (t.nombre_completo.toLowerCase().includes(needle)) return true;
    return (t.mascotas || []).some((m) => m.nombre?.toLowerCase().includes(needle));
  });

  async function pedirAcceso(tutor) {
    setBusyId(tutor.id);
    setError("");
    setMessage("");
    try {
      await solicitarCompartirPerfilTutor({
        clinicaId,
        clinicaNombre,
        tutorId: tutor.id,
      });
      setMessage(`Solicitud enviada a ${tutor.nombre_completo}. Esperá su aceptación.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
    } finally {
      setBusyId("");
    }
  }

  async function verPerfilCompartido(tutor) {
    setBusyId(tutor.id);
    setError("");
    try {
      setPerfil(await obtenerPerfilTutorCompartido(clinicaId, tutor.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el perfil.");
      setPerfil(null);
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-aguara-ink">Tutores Aguará</h2>
        <p className="text-sm text-stone-500">
          Solo ves nombre del tutor y de sus mascotas. Para más datos, pedí acceso: el tutor debe
          aceptar.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          className={fieldClass}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por tutor o mascota"
        />
        <button type="button" className={secondaryBtnClass} onClick={reload}>
          Actualizar
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      {perfil ? (
        <div className={cardClass}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-aguara-orange">Perfil compartido</p>
              <h3 className="text-xl font-semibold text-aguara-ink">
                {perfil.tutor.nombre_completo}
              </h3>
            </div>
            <button type="button" className={secondaryBtnClass} onClick={() => setPerfil(null)}>
              Cerrar
            </button>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-500">Email</dt>
              <dd>{perfil.tutor.email}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Teléfono</dt>
              <dd>{perfil.tutor.telefono || "—"}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Tel. secundario</dt>
              <dd>{perfil.tutor.telefono_secundario || "—"}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Dirección</dt>
              <dd>{perfil.tutor.direccion || "—"}</dd>
            </div>
          </dl>
          <h4 className="mt-4 text-sm font-semibold text-aguara-ink">Mascotas</h4>
          {perfil.mascotas.length === 0 ? (
            <p className="mt-1 text-sm text-stone-500">Sin mascotas con chapita.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {perfil.mascotas.map((m) => (
                <li key={m.id}>
                  <strong>{m.nombre_mascota}</strong>
                  {m.especie ? ` · ${m.especie}` : ""}
                  {m.raza ? ` · ${m.raza}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className={cardClass}>
        {loading ? (
          <p className="text-sm text-stone-500">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-stone-500">No hay tutores para mostrar.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {filtered.map((t) => {
              const estado = t.compartir?.estado;
              return (
                <li
                  key={t.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium text-aguara-ink">{t.nombre_completo}</p>
                    <p className="text-sm text-stone-500">
                      {t.mascotas.length === 0
                        ? "Sin mascotas registradas"
                        : t.mascotas.map((m) => m.nombre).join(" · ")}
                    </p>
                    {estado === "pendiente" ? (
                      <p className="mt-1 text-xs text-amber-700">Solicitud pendiente de aceptación</p>
                    ) : null}
                    {estado === "aceptada" ? (
                      <p className="mt-1 text-xs text-emerald-700">Perfil compartido</p>
                    ) : null}
                    {estado === "rechazada" ? (
                      <p className="mt-1 text-xs text-stone-500">Solicitud rechazada</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {estado === "aceptada" ? (
                      <button
                        type="button"
                        className={primaryBtnClass}
                        disabled={busyId === t.id}
                        onClick={() => verPerfilCompartido(t)}
                      >
                        Ver perfil
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={secondaryBtnClass}
                        disabled={busyId === t.id || estado === "pendiente"}
                        onClick={() => pedirAcceso(t)}
                      >
                        {estado === "pendiente"
                          ? "Pendiente…"
                          : estado === "rechazada"
                            ? "Volver a solicitar"
                            : "Pedir acceso"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
