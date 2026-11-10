"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Field,
  cardClass,
  fieldClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tutor/ui";
import { useTutorAuth } from "@/context/TutorAuthContext";
import {
  aceptarCambioPerfilTutor,
  aceptarCompartirPerfilTutor,
  actualizarTutor,
  listarClinicas,
  listarMascotasTutorCompletas,
  listarSolicitudesCompartirTutor,
  listarSolicitudesPerfilTutor,
  obtenerTutor,
  rechazarCambioPerfilTutor,
  rechazarCompartirPerfilTutor,
} from "@/lib/chapitas/tutorPortal";

const LABELS = {
  nombre_completo: "Nombre",
  telefono: "Teléfono",
  telefono_secundario: "Tel. secundario",
  direccion: "Dirección",
};

export default function PerfilSection({ tutor, onSolicitudesChange }) {
  const { refreshTutor } = useTutorAuth();
  const [clinicas, setClinicas] = useState([]);
  const [tieneChapita, setTieneChapita] = useState(true);
  const [solicitudes, setSolicitudes] = useState([]);
  const [compartir, setCompartir] = useState([]);
  const [form, setForm] = useState({
    nombre_completo: tutor.nombre_completo || "",
    telefono: tutor.telefono || "",
    telefono_secundario: tutor.telefono_secundario || "",
    direccion: tutor.direccion || "",
    clinica_preferida_id: tutor.clinica_preferida_id || "",
  });
  const [saving, setSaving] = useState(false);
  const [resolvingId, setResolvingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSolicitudes() {
    const [rows, shares] = await Promise.all([
      listarSolicitudesPerfilTutor(tutor.id, { soloPendientes: true }),
      listarSolicitudesCompartirTutor(tutor.id, { soloPendientes: true }),
    ]);
    setSolicitudes(rows);
    setCompartir(shares);
    onSolicitudesChange?.(rows.length + shares.length);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [profile, clinics, pets, sols, shares] = await Promise.all([
          obtenerTutor(tutor.id),
          listarClinicas(),
          listarMascotasTutorCompletas(tutor.id, tutor.email),
          listarSolicitudesPerfilTutor(tutor.id, { soloPendientes: true }),
          listarSolicitudesCompartirTutor(tutor.id, { soloPendientes: true }),
        ]);
        if (cancelled) return;
        setClinicas(clinics);
        setTieneChapita(pets.mascotas.some((m) => m.chapita_id));
        setSolicitudes(sols);
        setCompartir(shares);
        setForm({
          nombre_completo: profile.nombre_completo || "",
          telefono: profile.telefono || "",
          telefono_secundario: profile.telefono_secundario || "",
          direccion: profile.direccion || "",
          clinica_preferida_id: profile.clinica_preferida_id || "",
        });
        refreshTutor({ ...tutor, ...profile });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el perfil.");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutor.id]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await actualizarTutor(tutor.id, form);
      refreshTutor({ ...tutor, ...updated, email: tutor.email });
      setMessage("Perfil actualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function resolverSolicitud(id, aceptar) {
    setResolvingId(id);
    setError("");
    setMessage("");
    try {
      if (aceptar) {
        const updated = await aceptarCambioPerfilTutor(tutor.id, id);
        refreshTutor({ ...tutor, ...updated, email: tutor.email });
        setForm((f) => ({
          ...f,
          nombre_completo: updated.nombre_completo || "",
          telefono: updated.telefono || "",
          telefono_secundario: updated.telefono_secundario || "",
          direccion: updated.direccion || "",
        }));
        setMessage("Cambio aceptado. Tu perfil se actualizó.");
      } else {
        await rechazarCambioPerfilTutor(tutor.id, id);
        setMessage("Cambio rechazado. Tus datos quedan como estaban.");
      }
      await loadSolicitudes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo resolver la solicitud.");
    } finally {
      setResolvingId("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-aguara-ink">Perfil / Datos</h2>
        <p className="text-sm text-stone-500">Datos personales y sucursal de preferencia</p>
      </div>

      {compartir.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-aguara-ink">
            Solicitudes para ver tu perfil
          </h3>
          {compartir.map((sol) => (
            <div key={sol.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-950">
                {sol.clinicas?.nombre || "Clínica"}
                {sol.clinicas?.ciudad ? ` · ${sol.clinicas.ciudad}` : ""}
              </p>
              <p className="mt-1 text-sm text-amber-900/80">
                Quiere acceder a tu perfil (contacto y mascotas). Sin tu aceptación solo ven tu
                nombre y el de tus mascotas.
              </p>
              {sol.mensaje ? <p className="mt-2 text-sm text-amber-900">{sol.mensaje}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primaryBtnClass}
                  disabled={Boolean(resolvingId)}
                  onClick={async () => {
                    setResolvingId(sol.id);
                    setError("");
                    try {
                      await aceptarCompartirPerfilTutor(tutor.id, sol.id);
                      setMessage("Perfil compartido con la clínica.");
                      await loadSolicitudes();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "No se pudo aceptar.");
                    } finally {
                      setResolvingId("");
                    }
                  }}
                >
                  {resolvingId === sol.id ? "…" : "Aceptar"}
                </button>
                <button
                  type="button"
                  className={secondaryBtnClass}
                  disabled={Boolean(resolvingId)}
                  onClick={async () => {
                    setResolvingId(sol.id);
                    setError("");
                    try {
                      await rechazarCompartirPerfilTutor(tutor.id, sol.id);
                      setMessage("Solicitud rechazada.");
                      await loadSolicitudes();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "No se pudo rechazar.");
                    } finally {
                      setResolvingId("");
                    }
                  }}
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {solicitudes.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-aguara-ink">
            Cambios propuestos por clínicas
          </h3>
          {solicitudes.map((sol) => {
            const prev = sol.datos_anteriores || {};
            const next = sol.datos_propuestos || {};
            const keys = Object.keys(LABELS).filter(
              (k) => String(prev[k] || "") !== String(next[k] || ""),
            );
            return (
              <div
                key={sol.id}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
              >
                <p className="text-sm font-semibold text-amber-950">
                  {sol.clinicas?.nombre || "Clínica"}
                  {sol.clinicas?.ciudad ? ` · ${sol.clinicas.ciudad}` : ""}
                </p>
                <p className="mt-1 text-sm text-amber-900/80">
                  Proponen actualizar tu información. Solo se aplica si aceptás.
                </p>
                <ul className="mt-3 space-y-1 text-sm text-amber-950">
                  {keys.length === 0 ? (
                    <li>Sin diferencias detectadas.</li>
                  ) : (
                    keys.map((k) => (
                      <li key={k}>
                        <strong>{LABELS[k]}:</strong> {prev[k] || "—"} → {next[k] || "—"}
                      </li>
                    ))
                  )}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={primaryBtnClass}
                    disabled={Boolean(resolvingId)}
                    onClick={() => resolverSolicitud(sol.id, true)}
                  >
                    {resolvingId === sol.id ? "…" : "Aceptar cambio"}
                  </button>
                  <button
                    type="button"
                    className={secondaryBtnClass}
                    disabled={Boolean(resolvingId)}
                    onClick={() => resolverSolicitud(sol.id, false)}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!tieneChapita ? (
        <div className="rounded-2xl border border-aguara-orange/30 bg-aguara-cream/50 p-5">
          <p className="text-sm font-semibold text-aguara-ink">Conseguí tu chapita QR Aguará</p>
          <p className="mt-1 text-sm text-stone-600">
            Podés sacar turnos igual, pero con el QR tu mascota queda identificada si se pierde y
            vinculás su ficha a tu cuenta en segundos.
          </p>
          <Link href="/" className={`${primaryBtnClass} mt-4`}>
            Activar / comprar chapita
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
          Tip: si todavía no tenés chapita física para otra mascota,{" "}
          <Link href="/" className="font-medium text-aguara-orange underline">
            activá una nueva
          </Link>{" "}
          y vincularla a tu cuenta.
        </div>
      )}

      <form onSubmit={handleSubmit} className={`${cardClass} space-y-4`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre completo" id="tu-nombre">
            <input
              id="tu-nombre"
              required
              className={fieldClass}
              value={form.nombre_completo}
              onChange={(e) => setForm((f) => ({ ...f, nombre_completo: e.target.value }))}
            />
          </Field>
          <Field label="Email" id="tu-email">
            <input
              id="tu-email"
              disabled
              className={`${fieldClass} bg-stone-50 text-stone-500`}
              value={tutor.email}
            />
          </Field>
          <Field label="Teléfono" id="tu-tel">
            <input
              id="tu-tel"
              required
              className={fieldClass}
              value={form.telefono}
              onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
            />
          </Field>
          <Field label="Teléfono secundario" id="tu-tel2">
            <input
              id="tu-tel2"
              className={fieldClass}
              value={form.telefono_secundario}
              onChange={(e) => setForm((f) => ({ ...f, telefono_secundario: e.target.value }))}
            />
          </Field>
          <Field label="Dirección" id="tu-dir" className="sm:col-span-2">
            <input
              id="tu-dir"
              className={fieldClass}
              value={form.direccion}
              onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
            />
          </Field>
          <Field label="Sucursal de preferencia" id="tu-suc" className="sm:col-span-2">
            <select
              id="tu-suc"
              className={fieldClass}
              value={form.clinica_preferida_id}
              onChange={(e) => setForm((f) => ({ ...f, clinica_preferida_id: e.target.value }))}
            >
              <option value="">Sin preferencia</option>
              {clinicas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.ciudad ? ` · ${c.ciudad}` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <button type="submit" disabled={saving} className={primaryBtnClass}>
          {saving ? "Guardando…" : "Guardar perfil"}
        </button>
      </form>
    </div>
  );
}
