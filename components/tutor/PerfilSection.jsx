"use client";

import { useEffect, useState } from "react";

import { Field, cardClass, fieldClass, primaryBtnClass } from "@/components/tutor/ui";
import { useTutorAuth } from "@/context/TutorAuthContext";
import { actualizarTutor, listarClinicas, obtenerTutor } from "@/lib/chapitas/tutorPortal";

export default function PerfilSection({ tutor }) {
  const { refreshTutor } = useTutorAuth();
  const [clinicas, setClinicas] = useState([]);
  const [form, setForm] = useState({
    nombre_completo: tutor.nombre_completo || "",
    telefono: tutor.telefono || "",
    telefono_secundario: tutor.telefono_secundario || "",
    direccion: tutor.direccion || "",
    clinica_preferida_id: tutor.clinica_preferida_id || "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [profile, clinics] = await Promise.all([
          obtenerTutor(tutor.id),
          listarClinicas(),
        ]);
        if (cancelled) return;
        setClinicas(clinics);
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

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-aguara-ink">Perfil / Datos</h2>
        <p className="text-sm text-stone-500">Datos personales y sucursal de preferencia</p>
      </div>

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
