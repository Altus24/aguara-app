"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ClinicaLogoMark } from "@/components/clinica/ui";
import {
  Field,
  cardClass,
  fieldClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tutor/ui";
import { useTutorAuth } from "@/context/TutorAuthContext";
import { confirmAccion, confirmGuardar } from "@/lib/confirmAction";
import {
  ANTICIPACION_OPTS,
  CANAL_OPTS,
  emptyTutorPerfilForm,
  pedirPermisoNotificacionesMobile,
} from "@/lib/chapitas/tutorPerfilPrefs";
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
  dni: "DNI",
  direccion: "Dirección",
  calle: "Calle",
  numeracion: "Numeración",
  tipo_vivienda: "Tipo de vivienda",
  piso_depto: "Piso / depto",
  localidad: "Localidad",
  provincia: "Provincia",
  maps_url: "Ubicación Maps",
};

function toggleInList(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export default function PerfilSection({ tutor, onSolicitudesChange }) {
  const { refreshTutor } = useTutorAuth();
  const [clinicas, setClinicas] = useState([]);
  const [tieneChapita, setTieneChapita] = useState(true);
  const [solicitudes, setSolicitudes] = useState([]);
  const [compartir, setCompartir] = useState([]);
  const [mascotas, setMascotas] = useState([]);
  const [mascotaElegida, setMascotaElegida] = useState({});
  const [form, setForm] = useState(() => emptyTutorPerfilForm(tutor));
  const [saving, setSaving] = useState(false);
  const [enablingNotif, setEnablingNotif] = useState(false);
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
        setMascotas(pets.mascotas || []);
        setTieneChapita(pets.mascotas.some((m) => m.chapita_id));
        setSolicitudes(sols);
        setCompartir(shares);
        setMascotaElegida((prev) => {
          const next = { ...prev };
          for (const sol of shares) {
            if (!next[sol.id] && pets.mascotas?.[0]?.chapita_id) {
              next[sol.id] = pets.mascotas[0].chapita_id;
            } else if (!next[sol.id] && pets.mascotas?.[0]?.key) {
              next[sol.id] = pets.mascotas[0].chapita_id || pets.mascotas[0].id || "";
            }
          }
          return next;
        });
        setForm(emptyTutorPerfilForm(profile));
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
    if (!(await confirmGuardar("el perfil del tutor"))) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await actualizarTutor(tutor.id, form);
      setForm(emptyTutorPerfilForm(updated));
      refreshTutor({ ...tutor, ...updated, email: tutor.email });
      setMessage("Perfil actualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleNotifMobile(checked) {
    setError("");
    setMessage("");
    setEnablingNotif(true);
    try {
      if (!checked) {
        const { disablePushNotifications } = await import("@/lib/chapitas/pushClient");
        await disablePushNotifications();
        setForm((f) => ({ ...f, notif_push_mobile: false }));
        setMessage("Notificaciones push desactivadas. Guardá el perfil para confirmar.");
        return;
      }
      await pedirPermisoNotificacionesMobile(tutor.id);
      setForm((f) => ({ ...f, notif_push_mobile: true }));
      setMessage("Notificaciones push activadas. Guardá el perfil para confirmar.");
    } catch (err) {
      setForm((f) => ({ ...f, notif_push_mobile: false }));
      setError(err instanceof Error ? err.message : "No se pudieron activar las notificaciones.");
    } finally {
      setEnablingNotif(false);
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
          ...emptyTutorPerfilForm(updated),
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
        <p className="text-sm text-stone-500">
          Datos personales, dirección detallada, notificaciones y recordatorios
        </p>
      </div>

      {compartir.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-aguara-ink">
            Solicitudes para ver tu perfil
          </h3>
          {compartir.map((sol) => (
            <div key={sol.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-3">
                <ClinicaLogoMark
                  logoUrl={sol.clinicas?.logo_url}
                  nombre={sol.clinicas?.nombre}
                  size={40}
                />
                <p className="text-sm font-semibold text-amber-950">
                  {sol.clinicas?.nombre || "Clínica"}
                  {sol.clinicas?.ciudad ? ` · ${sol.clinicas.ciudad}` : ""}
                </p>
              </div>
              <p className="mt-1 text-sm text-amber-900/80">
                Quiere ver tus datos de contacto y una mascota que elijas. Sin aceptar solo ven tu
                nombre y los nombres de tus mascotas.
              </p>
              {sol.mensaje ? <p className="mt-2 text-sm text-amber-900">{sol.mensaje}</p> : null}
              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium text-amber-950" htmlFor={`share-pet-${sol.id}`}>
                  Mascota a compartir
                </label>
                <select
                  id={`share-pet-${sol.id}`}
                  className={fieldClass}
                  value={mascotaElegida[sol.id] || ""}
                  onChange={(e) =>
                    setMascotaElegida((prev) => ({ ...prev, [sol.id]: e.target.value }))
                  }
                >
                  <option value="">Seleccionar mascota…</option>
                  {mascotas
                    .filter((m) => m.chapita_id)
                    .map((m) => (
                      <option key={m.key} value={m.chapita_id}>
                        {m.nombre}
                        {m.especie ? ` · ${m.especie}` : ""}
                      </option>
                    ))}
                </select>
                {mascotas.filter((m) => m.chapita_id).length === 0 ? (
                  <p className="mt-1 text-xs text-amber-800">
                    Necesitás una mascota con identificador QR para compartir.
                  </p>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primaryBtnClass}
                  disabled={Boolean(resolvingId)}
                  onClick={async () => {
                    setResolvingId(sol.id);
                    setError("");
                    try {
                      await aceptarCompartirPerfilTutor(
                        tutor.id,
                        sol.id,
                        mascotaElegida[sol.id],
                      );
                      setMessage("Compartiste tu perfil y la mascota elegida con la clínica.");
                      await loadSolicitudes();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "No se pudo aceptar.");
                    } finally {
                      setResolvingId("");
                    }
                  }}
                >
                  {resolvingId === sol.id ? "…" : "Aceptar y compartir"}
                </button>
                <button
                  type="button"
                  className={secondaryBtnClass}
                  disabled={Boolean(resolvingId)}
                  onClick={async () => {
                    const clinicaLabel = sol.clinicas?.nombre || "la clínica";
                    if (
                      !(await confirmAccion(
                        `¿Rechazar la solicitud de ${clinicaLabel}?`,
                      ))
                    ) {
                      return;
                    }
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
                <div className="flex items-center gap-3">
                  <ClinicaLogoMark
                    logoUrl={sol.clinicas?.logo_url}
                    nombre={sol.clinicas?.nombre}
                    size={40}
                  />
                  <p className="text-sm font-semibold text-amber-950">
                    {sol.clinicas?.nombre || "Clínica"}
                    {sol.clinicas?.ciudad ? ` · ${sol.clinicas.ciudad}` : ""}
                  </p>
                </div>
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
          <p className="text-sm font-semibold text-aguara-ink">Conseguí tu identificador QR Aguará</p>
          <p className="mt-1 text-sm text-stone-600">
            Todavía no tenés un QR registrado. Con el identificador tu mascota queda identificada si se
            pierde y vinculás su ficha a tu cuenta en segundos.
          </p>
          <Link href="/" className={`${primaryBtnClass} mt-4`}>
            Activar / comprar identificador
          </Link>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className={`${cardClass} space-y-5`}>
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
          <Field label="DNI" id="tu-dni">
            <input
              id="tu-dni"
              inputMode="numeric"
              autoComplete="off"
              className={fieldClass}
              value={form.dni}
              onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))}
            />
          </Field>
        </div>

        <div className="space-y-3 border-t border-stone-100 pt-4">
          <h3 className="text-sm font-semibold text-aguara-ink">Dirección</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Calle" id="tu-calle">
              <input
                id="tu-calle"
                className={fieldClass}
                value={form.calle}
                onChange={(e) => setForm((f) => ({ ...f, calle: e.target.value }))}
                placeholder="Ej. Av. San Martín"
              />
            </Field>
            <Field label="Numeración" id="tu-num">
              <input
                id="tu-num"
                className={fieldClass}
                value={form.numeracion}
                onChange={(e) => setForm((f) => ({ ...f, numeracion: e.target.value }))}
                placeholder="Ej. 1234"
              />
            </Field>
            <Field label="Casa o edificio" id="tu-vivienda">
              <select
                id="tu-vivienda"
                className={fieldClass}
                value={form.tipo_vivienda}
                onChange={(e) => setForm((f) => ({ ...f, tipo_vivienda: e.target.value }))}
              >
                <option value="">Seleccionar…</option>
                <option value="casa">Casa</option>
                <option value="edificio">Edificio</option>
              </select>
            </Field>
            <Field label="Piso / departamento" id="tu-piso">
              <input
                id="tu-piso"
                className={fieldClass}
                value={form.piso_depto}
                onChange={(e) => setForm((f) => ({ ...f, piso_depto: e.target.value }))}
                placeholder={form.tipo_vivienda === "edificio" ? "Ej. 3° B" : "Opcional"}
              />
            </Field>
            <Field label="Localidad" id="tu-localidad">
              <input
                id="tu-localidad"
                className={fieldClass}
                value={form.localidad}
                onChange={(e) => setForm((f) => ({ ...f, localidad: e.target.value }))}
                placeholder="Ej. Godoy Cruz"
              />
            </Field>
            <Field label="Provincia" id="tu-provincia">
              <input
                id="tu-provincia"
                className={fieldClass}
                value={form.provincia}
                onChange={(e) => setForm((f) => ({ ...f, provincia: e.target.value }))}
                placeholder="Ej. Mendoza"
              />
            </Field>
            <Field label="Link de ubicación (Google Maps)" id="tu-maps" className="sm:col-span-2">
              <input
                id="tu-maps"
                type="url"
                className={fieldClass}
                value={form.maps_url}
                onChange={(e) => setForm((f) => ({ ...f, maps_url: e.target.value }))}
                placeholder="https://maps.google.com/… (pegar enlace de Maps)"
              />
            </Field>
          </div>
        </div>

        <div className="space-y-3 border-t border-stone-100 pt-4">
          <h3 className="text-sm font-semibold text-aguara-ink">Notificaciones</h3>
          <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50/60 p-3 text-sm text-aguara-ink">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.notif_push_mobile}
              disabled={enablingNotif}
              onChange={(e) => handleToggleNotifMobile(e.target.checked)}
            />
              <span>
              <span className="font-medium">Activar notificaciones push</span>
              <span className="mt-0.5 block text-stone-500">
                Avisos con sonido aunque la app esté cerrada (turnos, escaneos, recordatorios).
                En iPhone hace falta instalar Aguará en Inicio.
                {enablingNotif ? " Activando…" : ""}
              </span>
            </span>
          </label>
        </div>

        <div className="space-y-3 border-t border-stone-100 pt-4">
          <h3 className="text-sm font-semibold text-aguara-ink">Recordatorios</h3>
          <p className="text-sm text-stone-500">
            Elegí cuánto antes avisarte y por qué canales (podés marcar varios).
          </p>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-aguara-ink">Anticipación</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ANTICIPACION_OPTS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-aguara-ink"
                >
                  <input
                    type="checkbox"
                    checked={form.recordatorio_anticipacion.includes(opt.id)}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        recordatorio_anticipacion: toggleInList(f.recordatorio_anticipacion, opt.id),
                      }))
                    }
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-aguara-ink">Canales</legend>
            <div className="grid gap-2 sm:grid-cols-1">
              {CANAL_OPTS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-aguara-ink"
                >
                  <input
                    type="checkbox"
                    checked={form.recordatorio_canales.includes(opt.id)}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        recordatorio_canales: toggleInList(f.recordatorio_canales, opt.id),
                      }))
                    }
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="border-t border-stone-100 pt-4">
          <Field label="Sucursal de preferencia" id="tu-suc">
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
            {(() => {
              const preferida = clinicas.find((c) => c.id === form.clinica_preferida_id);
              if (!preferida) return null;
              return (
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2">
                  <ClinicaLogoMark
                    logoUrl={preferida.logo_url}
                    nombre={preferida.nombre}
                    size={40}
                  />
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-aguara-ink">{preferida.nombre}</p>
                    {preferida.ciudad ? (
                      <p className="text-stone-500">{preferida.ciudad}</p>
                    ) : null}
                  </div>
                </div>
              );
            })()}
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
