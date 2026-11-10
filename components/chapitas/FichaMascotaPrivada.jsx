"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  actualizarDatosBasicosMascota,
  cargarPerfilClinicoMascota,
} from "@/lib/chapitas/mascotaPerfil";
import { etiquetaEstado } from "@/lib/chapitas/clinicaOps";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString("es-AR");
  } catch {
    return String(value);
  }
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

/**
 * Bloque privado: solo para el tutor dueño.
 * No altera la ficha pública visible al escanear el QR.
 */
export default function FichaMascotaPrivada({ chapitaId, tutorId }) {
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [peso, setPeso] = useState("");
  const [saving, setSaving] = useState(false);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const data = await cargarPerfilClinicoMascota(chapitaId);
      setPerfil(data);
      setFechaNacimiento(data?.fecha_nacimiento || "");
      setPeso(data?.peso != null ? String(data.peso) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el perfil clínico.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!chapitaId || !tutorId) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapitaId, tutorId]);

  async function handleSaveBasics(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await actualizarDatosBasicosMascota(chapitaId, {
        fecha_nacimiento: fechaNacimiento,
        peso,
      });
      setEditing(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los datos.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-6 rounded-lg border border-orange-100 bg-orange-50/40 p-5 text-sm text-stone-600">
        Cargando ficha clínica…
      </div>
    );
  }

  if (!perfil) return null;

  return (
    <div className="mt-6 space-y-5 rounded-lg border border-orange-200 bg-orange-50/30 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
            Solo vos lo ves
          </p>
          <h2 className="mt-1 text-xl font-semibold text-orange-800">Ficha clínica de tu mascota</h2>
          <p className="mt-1 text-sm text-stone-600">
            Estos datos no aparecen cuando alguien escanea el QR.
          </p>
        </div>
        <Link
          href="/tutor"
          className="text-sm font-medium text-orange-700 underline hover:text-orange-900"
        >
          Ir a mi cuenta
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-stone-900">Edad / peso</h3>
          <button
            type="button"
            className="text-sm text-orange-700 underline"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Cancelar" : "Editar"}
          </button>
        </div>

        {editing ? (
          <form onSubmit={handleSaveBasics} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-stone-700">Fecha de nacimiento</span>
              <input
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-stone-700">Peso actual (kg)</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-full bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60 sm:col-span-2"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </form>
        ) : (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-500">Fecha de nacimiento</dt>
              <dd className="font-medium text-stone-900">{formatDate(perfil.fecha_nacimiento)}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Edad</dt>
              <dd className="font-medium text-stone-900">{perfil.edad || "—"}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Peso actual</dt>
              <dd className="font-medium text-stone-900">
                {perfil.peso != null ? `${perfil.peso} kg` : "—"}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-stone-900">Vacunas</h3>
        {perfil.vacunas.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">Sin vacunas cargadas por la clínica.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {perfil.vacunas.map((v) => (
              <li key={v.id} className="rounded-lg bg-stone-50 px-3 py-2">
                <strong>{v.nombre}</strong> · aplicada {formatDate(v.fecha)}
                {v.proxima_fecha ? (
                  <span className="block text-orange-700">
                    Próxima: {formatDate(v.proxima_fecha)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-stone-900">Historial de consultas</h3>
        {perfil.consultas.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">Sin consultas registradas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {perfil.consultas.map((c) => (
              <li key={c.id} className="py-2 text-sm">
                <p className="font-medium text-stone-900">{formatDateTime(c.fecha)}</p>
                <p className="text-stone-600">Motivo: {c.motivo || "—"}</p>
                <p className="text-stone-600">Diagnóstico: {c.diagnostico || "—"}</p>
                {c.tratamiento ? (
                  <p className="text-stone-600">Tratamiento: {c.tratamiento}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-stone-900">Próxima cita</h3>
        {!perfil.proximaCita ? (
          <p className="mt-2 text-sm text-stone-500">No hay una próxima cita cargada.</p>
        ) : (
          <div className="mt-2 text-sm">
            <p className="font-medium text-stone-900">
              {formatDateTime(perfil.proximaCita.inicio)}
            </p>
            <p className="text-stone-600">
              {perfil.proximaCita.clinicas?.nombre || "Clínica"}
              {perfil.proximaCita.clinicas?.ciudad
                ? ` · ${perfil.proximaCita.clinicas.ciudad}`
                : ""}
            </p>
            {perfil.proximaCita.motivo ? (
              <p className="text-stone-600">Motivo: {perfil.proximaCita.motivo}</p>
            ) : null}
            <p className="mt-1 text-stone-500">
              Estado: {etiquetaEstado(perfil.proximaCita.estado)}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-stone-900">Tratamientos activos</h3>
        {perfil.tratamientos.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">Sin tratamientos activos.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {perfil.tratamientos.map((t) => (
              <li key={t.id} className="rounded-lg bg-stone-50 px-3 py-2">
                <strong>{t.titulo}</strong>
                {t.detalle ? <span className="block text-stone-600">{t.detalle}</span> : null}
                <span className="mt-1 block text-stone-500">
                  Desde {formatDate(t.fecha_inicio)}
                  {t.de_por_vida
                    ? " · De por vida"
                    : t.fecha_fin
                      ? ` · Hasta ${formatDate(t.fecha_fin)}`
                      : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
