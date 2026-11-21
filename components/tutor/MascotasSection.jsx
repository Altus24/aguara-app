"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import MascotaRegistroFields, {
  EMPTY_PET_FORM,
  validateMascotaRegistroForm,
} from "@/components/mascotas/MascotaRegistroFields";
import {
  cardClass,
  fieldClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tutor/ui";
import { confirmGuardar } from "@/lib/confirmAction";
import {
  chapitaDisponibleParaActivar,
  crearMascotaSinChapita,
  vincularChapitaAMascotaDigital,
} from "@/lib/chapitas/mascotasTutor";
import { listarClinicas, listarMascotasTutorCompletas } from "@/lib/chapitas/tutorPortal";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function MascotasSection({ tutor }) {
  const [mascotas, setMascotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(null); // 'crear' | 'vincular' | null
  const [petForm, setPetForm] = useState(EMPTY_PET_FORM);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [chapitaCodigo, setChapitaCodigo] = useState("");
  const [mascotaDigitalId, setMascotaDigitalId] = useState("");
  const [message, setMessage] = useState("");
  const [clinicas, setClinicas] = useState([]);

  const digitales = mascotas.filter((m) => m.sin_chapita);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const data = await listarMascotasTutorCompletas(tutor.id, tutor.email);
      setMascotas(data.mascotas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las mascotas.");
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
        const [data, clinicasRows] = await Promise.all([
          listarMascotasTutorCompletas(tutor.id, tutor.email),
          listarClinicas().catch(() => []),
        ]);
        if (!cancelled) {
          setMascotas(data.mascotas);
          setClinicas(clinicasRows || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar las mascotas.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tutor.id, tutor.email]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  function resetForms() {
    setPetForm(EMPTY_PET_FORM);
    setFoto(null);
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreview(null);
    setChapitaCodigo("");
    setMascotaDigitalId("");
    setMessage("");
    setError("");
  }

  function handlePhoto(event) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
      setFoto(null);
      setPreview(null);
      return;
    }
    if (!PHOTO_TYPES.has(file.type)) {
      setError("La foto tiene que ser JPG, PNG o WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("La foto no puede superar 4 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setFoto(file);
    setPreview(url);
  }

  async function handleCrear(event) {
    event.preventDefault();
    event.stopPropagation();
    const invalid = validateMascotaRegistroForm(petForm);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!(await confirmGuardar(`la mascota “${petForm.nombre_mascota.trim()}”`))) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await crearMascotaSinChapita(tutor, petForm, { foto });
      setMessage("Mascota creada. Cuando tengas la chapita, podés vincularla.");
      resetForms();
      setMode(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la mascota.");
    } finally {
      setSaving(false);
    }
  }

  async function handleVincular(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!mascotaDigitalId) {
      setError("Elegí la mascota a la que querés vincular la chapita.");
      return;
    }
    if (!(await confirmGuardar("el vínculo de la chapita a la mascota"))) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const check = await chapitaDisponibleParaActivar(chapitaCodigo);
      if (!check.ok) throw new Error(check.message);
      const result = await vincularChapitaAMascotaDigital({
        tutorId: tutor.id,
        mascotaDigitalId,
        chapitaCodigo: check.id,
      });
      setMessage(`Chapita ${result.chapita_id || check.id} vinculada.`);
      resetForms();
      setMode(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo vincular la chapita.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-aguara-ink">Mis mascotas</h2>
          <p className="text-sm text-stone-500">
            Creá el perfil sin chapita y vinculala después con el código del QR
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={primaryBtnClass}
            onClick={() => {
              resetForms();
              setMode((m) => (m === "crear" ? null : "crear"));
            }}
          >
            Agregar mascota
          </button>
          <button
            type="button"
            className={secondaryBtnClass}
            onClick={() => {
              resetForms();
              setMode((m) => (m === "vincular" ? null : "vincular"));
              const first = digitales[0]?.chapita_id || "";
              setMascotaDigitalId(first);
            }}
          >
            Vincular chapita
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      {mode === "crear" ? (
        <form onSubmit={handleCrear} className={`${cardClass} space-y-4`}>
          <h3 className="font-semibold text-aguara-ink">Nueva mascota (sin chapita)</h3>
          <p className="text-sm text-stone-500">
            Mismos datos que al activar una chapita. Después podés vincular el QR.
          </p>
          <MascotaRegistroFields
            form={petForm}
            onChange={(name, value) => setPetForm((f) => ({ ...f, [name]: value }))}
            preview={preview}
            onPhoto={handlePhoto}
            fieldClass={fieldClass}
            fotoInputId="tutor-foto"
            showTitle={false}
            clinicas={clinicas}
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className={primaryBtnClass}>
              {saving ? "Guardando…" : "Crear mascota"}
            </button>
            <button type="button" className={secondaryBtnClass} onClick={() => setMode(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {mode === "vincular" ? (
        <form onSubmit={handleVincular} className={`${cardClass} space-y-4`}>
          <h3 className="font-semibold text-aguara-ink">Vincular chapita QR</h3>
          <p className="text-sm text-stone-500">
            Ingresá el código impreso en la chapita (ej. T2-015 o el de 8 caracteres).
          </p>
          {digitales.length === 0 ? (
            <p className="text-sm text-amber-800">
              No tenés mascotas sin chapita. Primero creá una con “Agregar mascota”.
            </p>
          ) : (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-stone-700">Mascota sin chapita</span>
                <select
                  required
                  className={fieldClass}
                  value={mascotaDigitalId}
                  onChange={(e) => setMascotaDigitalId(e.target.value)}
                >
                  <option value="">Seleccionar…</option>
                  {digitales.map((m) => (
                    <option key={m.chapita_id} value={m.chapita_id}>
                      {m.nombre} · {m.especie}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-stone-700">Código de la chapita</span>
                <input
                  required
                  placeholder="Ej: T2-015"
                  className={fieldClass}
                  value={chapitaCodigo}
                  onChange={(e) => setChapitaCodigo(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={saving} className={primaryBtnClass}>
                  {saving ? "Vinculando…" : "Vincular chapita"}
                </button>
                <button type="button" className={secondaryBtnClass} onClick={() => setMode(null)}>
                  Cancelar
                </button>
              </div>
            </>
          )}
        </form>
      ) : null}

      <div className={cardClass}>
        {loading ? (
          <p className="text-sm text-stone-500">Cargando…</p>
        ) : mascotas.length === 0 ? (
          <p className="text-sm text-stone-600">
            Todavía no tenés mascotas. Creá una sin chapita o activá un QR.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {mascotas.map((m) => {
              const href = m.chapita_id ? `/tutor/mascota/${m.chapita_id}` : null;
              const content = (
                <>
                  {m.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.foto_url}
                      alt=""
                      className="size-16 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="grid size-16 place-items-center rounded-2xl bg-aguara-cream text-xl font-semibold text-aguara-orange">
                      {m.nombre?.charAt(0)?.toUpperCase() || "·"}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-aguara-ink">
                      {m.nombre}
                      {m.sin_chapita ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                          sin chapita
                        </span>
                      ) : m.chapita_id ? (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                          chapita
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm text-stone-600">
                      {m.especie}
                      {m.raza ? ` · ${m.raza}` : ""}
                    </span>
                    <span className="mt-1 block text-sm text-stone-500">
                      {m.edad || "Edad sin cargar"}
                      {m.sin_chapita
                        ? " · Sin QR todavía"
                        : m.chapita_id
                          ? ` · Chapita ${m.chapita_id}`
                          : ""}
                    </span>
                  </span>
                </>
              );

              return (
                <li key={m.key}>
                  {href ? (
                    <Link
                      href={href}
                      className="flex items-center gap-4 rounded-2xl border border-stone-100 p-3 transition hover:border-aguara-orange/40 hover:bg-aguara-cream/30"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-4 rounded-2xl border border-stone-100 p-3">
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
