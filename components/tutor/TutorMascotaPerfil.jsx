"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useTutorAuth } from "@/context/TutorAuthContext";
import { etiquetaEstado } from "@/lib/chapitas/clinicaOps";
import {
  actualizarDatosBasicosMascota,
  cargarPerfilClinicoMascota,
} from "@/lib/chapitas/mascotaPerfil";
import { cardClass, fieldClass, primaryBtnClass, secondaryBtnClass } from "@/components/tutor/ui";

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

export default function TutorMascotaPerfil() {
  const params = useParams();
  const router = useRouter();
  const chapitaId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { tutor, isAuthenticated, authLoading } = useTutorAuth();

  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [peso, setPeso] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/tutor/login?from=/tutor/mascota/${chapitaId}`);
    }
  }, [authLoading, isAuthenticated, router, chapitaId]);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const data = await cargarPerfilClinicoMascota(chapitaId);
      if (!data) {
        setPerfil(null);
        setError("No encontramos esa mascota.");
        return;
      }
      if (tutor?.id && data.tutor_id && data.tutor_id !== tutor.id) {
        setPerfil(null);
        setError("Esta mascota no pertenece a tu cuenta.");
        return;
      }
      setPerfil(data);
      setFechaNacimiento(data.fecha_nacimiento || "");
      setPeso(data.peso != null ? String(data.peso) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el perfil.");
      setPerfil(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!chapitaId || authLoading || !isAuthenticated || !tutor?.id) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapitaId, authLoading, isAuthenticated, tutor?.id]);

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

  if (authLoading || loading) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-stone-500">
        Cargando…
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-stone-500">
        Redirigiendo…
      </section>
    );
  }

  if (error && !perfil) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <Link href="/tutor" className="mt-4 inline-block text-sm text-aguara-orange underline">
          Volver a mis mascotas
        </Link>
      </section>
    );
  }

  if (!perfil) return null;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/tutor" className={secondaryBtnClass}>
          ← Mis mascotas
        </Link>
      </div>

      <div className={`${cardClass} mb-5`}>
        <div className="flex items-start gap-4">
          {perfil.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={perfil.foto_url}
              alt=""
              className="size-20 rounded-2xl object-cover"
            />
          ) : (
            <span className="grid size-20 place-items-center rounded-2xl bg-aguara-cream text-2xl font-semibold text-aguara-orange">
              {perfil.nombre?.charAt(0)?.toUpperCase() || "·"}
            </span>
          )}
          <div>
            <p className="text-sm font-medium text-aguara-orange">Mi mascota</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-aguara-ink">
              {perfil.nombre}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              {perfil.especie || "Mascota"}
              {perfil.raza ? ` · ${perfil.raza}` : ""}
              {perfil.sexo ? ` · ${perfil.sexo}` : ""}
            </p>
            {perfil.nro_chip ? (
              <p className="mt-1 text-sm text-stone-500">Chip: {perfil.nro_chip}</p>
            ) : null}
            {perfil.castrado != null ? (
              <p className="mt-1 text-sm text-stone-500">
                Castrado/a: {perfil.castrado ? "Sí" : "No"}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-stone-400">Chapita {perfil.chapitaId}</p>
          </div>
        </div>
      </div>

      {error ? (
        <p className="mb-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-5">
        <section className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-aguara-ink">Edad / peso</h2>
            <button
              type="button"
              className="text-sm text-aguara-orange underline"
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
                  className={fieldClass}
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
                  className={fieldClass}
                />
              </label>
              <button type="submit" disabled={saving} className={`${primaryBtnClass} sm:col-span-2`}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </form>
          ) : (
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-stone-500">Fecha de nacimiento</dt>
                <dd className="font-medium text-aguara-ink">{formatDate(perfil.fecha_nacimiento)}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Edad</dt>
                <dd className="font-medium text-aguara-ink">{perfil.edad || "—"}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Peso actual</dt>
                <dd className="font-medium text-aguara-ink">
                  {perfil.peso != null ? `${perfil.peso} kg` : "—"}
                </dd>
              </div>
            </dl>
          )}
        </section>

        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-aguara-ink">Vacunas</h2>
          {perfil.vacunas.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">Sin vacunas cargadas por la clínica.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {perfil.vacunas.map((v) => (
                <li key={v.id} className="rounded-xl bg-aguara-cream/40 px-3 py-2">
                  <strong>{v.nombre}</strong> · aplicada {formatDate(v.fecha)}
                  {v.proxima_fecha ? (
                    <span className="block text-aguara-orange">
                      Próxima: {formatDate(v.proxima_fecha)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-aguara-ink">Historial de consultas</h2>
          {perfil.consultas.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">Sin consultas registradas.</p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {perfil.consultas.map((c) => (
                <li key={c.id} className="py-3 text-sm">
                  <p className="font-medium text-aguara-ink">{formatDateTime(c.fecha)}</p>
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

        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-aguara-ink">Próxima cita</h2>
          {!perfil.proximaCita ? (
            <p className="mt-2 text-sm text-stone-500">No hay una próxima cita cargada.</p>
          ) : (
            <div className="mt-2 text-sm">
              <p className="font-medium text-aguara-ink">
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

        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-aguara-ink">Tratamientos activos</h2>
          {perfil.tratamientos.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">Sin tratamientos activos.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {perfil.tratamientos.map((t) => (
                <li key={t.id} className="rounded-xl bg-aguara-cream/40 px-3 py-2">
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
    </section>
  );
}
