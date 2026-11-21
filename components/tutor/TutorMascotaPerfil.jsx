"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useTutorAuth } from "@/context/TutorAuthContext";
import { etiquetaEstado } from "@/lib/chapitas/clinicaOps";
import { isDigitalMascotaId } from "@/lib/chapitas/chapitaId";
import {
  actualizarDatosBasicosMascota,
  actualizarFotoMascota,
  cargarPerfilClinicoMascota,
} from "@/lib/chapitas/mascotaPerfil";
import {
  chapitaDisponibleParaActivar,
  vincularChapitaAMascotaDigital,
} from "@/lib/chapitas/mascotasTutor";
import {
  crearTratamientoTutor,
  crearVacunaTutor,
  eliminarTratamientoTutor,
  eliminarVacunaTutor,
  listarClinicas,
} from "@/lib/chapitas/tutorPortal";
import { esVacunaVencida, vacunasParaEspecie } from "@/lib/chapitas/vacunas";
import { confirmEliminar, confirmGuardar } from "@/lib/confirmAction";
import { TEMPERAMENTOS_MASCOTA } from "@/components/mascotas/MascotaRegistroFields";
import {
  Field,
  cardClass,
  fieldClass,
  formatDate,
  formatDateTime,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tutor/ui";

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
  const [castrado, setCastrado] = useState("");
  const [temperamento, setTemperamento] = useState("");
  const [clinicaCabeceraId, setClinicaCabeceraId] = useState("");
  const [clinicas, setClinicas] = useState([]);
  const [saving, setSaving] = useState(false);
  const [codigoChapita, setCodigoChapita] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [fotoMsg, setFotoMsg] = useState("");
  const fotoInputRef = useRef(null);
  const sinChapita = isDigitalMascotaId(chapitaId);

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
      setCastrado(data.castrado === true ? "si" : data.castrado === false ? "no" : "ns");
      setTemperamento(data.temperamento || "");
      setClinicaCabeceraId(data.clinica_cabecera_id || "");
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

  useEffect(() => {
    let cancelled = false;
    listarClinicas()
      .then((rows) => {
        if (!cancelled) setClinicas(rows || []);
      })
      .catch(() => {
        if (!cancelled) setClinicas([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveBasics(event) {
    event.preventDefault();
    if (!(await confirmGuardar("los datos de la mascota"))) return;
    setSaving(true);
    setError("");
    try {
      await actualizarDatosBasicosMascota(chapitaId, {
        fecha_nacimiento: fechaNacimiento,
        peso,
        castrado,
        temperamento,
        clinica_cabecera_id: clinicaCabeceraId || null,
      });
      setEditing(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los datos.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFotoChange(event) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (!(await confirmGuardar("la nueva foto de perfil"))) return;
    setUploadingFoto(true);
    setError("");
    setFotoMsg("");
    try {
      await actualizarFotoMascota(chapitaId, file);
      setFotoMsg("Foto actualizada.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la foto.");
    } finally {
      setUploadingFoto(false);
    }
  }

  async function handleVincularChapita(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!(await confirmGuardar("el vínculo de la chapita a esta mascota"))) return;
    setLinking(true);
    setError("");
    setLinkMsg("");
    try {
      const check = await chapitaDisponibleParaActivar(codigoChapita);
      if (!check.ok) throw new Error(check.message);
      const result = await vincularChapitaAMascotaDigital({
        tutorId: tutor.id,
        mascotaDigitalId: chapitaId,
        chapitaCodigo: check.id,
      });
      const nuevoId = result.chapita_id || check.id;
      setLinkMsg(`Chapita ${nuevoId} vinculada.`);
      router.replace(`/tutor/mascota/${encodeURIComponent(nuevoId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo vincular la chapita.");
    } finally {
      setLinking(false);
    }
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const recordatoriosPerfil = useMemo(() => {
    if (!perfil) return [];
    const rows = [];
    for (const v of perfil.vacunas || []) {
      if (v.proxima_fecha && v.proxima_fecha >= hoy) {
        rows.push({
          id: `vac-${v.origen || "c"}-${v.id}`,
          tipo: "Vacuna",
          title: v.nombre,
          date: v.proxima_fecha,
          sort: v.proxima_fecha,
        });
      }
    }
    if (perfil.proximaCita?.inicio) {
      const dia = String(perfil.proximaCita.inicio).slice(0, 10);
      if (dia >= hoy) {
        rows.push({
          id: `cita-${perfil.proximaCita.id}`,
          tipo: "Cita",
          title: perfil.proximaCita.clinicas?.nombre || "Clínica",
          dateLabel: formatDateTime(perfil.proximaCita.inicio),
          detail: perfil.proximaCita.motivo || etiquetaEstado(perfil.proximaCita.estado),
          sort: dia,
        });
      }
    }
    return rows.sort((a, b) => String(a.sort).localeCompare(String(b.sort)));
  }, [perfil, hoy]);

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
        <Link href="/tutor?tab=recordatorios" className="text-sm font-medium text-aguara-orange underline">
          Ver todos los recordatorios
        </Link>
      </div>

      <div className={`${cardClass} mb-5`}>
        <div className="flex items-start gap-4">
          <div className="shrink-0">
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
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFotoChange}
            />
            <button
              type="button"
              disabled={uploadingFoto}
              className="mt-2 w-full text-center text-xs font-medium text-aguara-orange underline disabled:opacity-60"
              onClick={() => fotoInputRef.current?.click()}
            >
              {uploadingFoto ? "Subiendo…" : perfil.foto_url ? "Cambiar foto" : "Agregar foto"}
            </button>
          </div>
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
            <p className="mt-1 text-sm text-stone-500">
              Castrado/a:{" "}
              {perfil.castrado === true ? "Sí" : perfil.castrado === false ? "No" : "No lo sé"}
            </p>
            {perfil.temperamento ? (
              <p className="mt-1 text-sm text-stone-500">Temperamento: {perfil.temperamento}</p>
            ) : null}
            {sinChapita ? (
              <p className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                Sin chapita todavía
              </p>
            ) : (
              <p className="mt-1 text-xs text-stone-400">Chapita {perfil.chapitaId}</p>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <p className="mb-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {fotoMsg ? <p className="mb-4 text-sm text-emerald-700">{fotoMsg}</p> : null}
      {linkMsg ? <p className="mb-4 text-sm text-emerald-700">{linkMsg}</p> : null}

      <div className="space-y-5">
        <section className={cardClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-aguara-ink">Recordatorios</h2>
              <p className="text-sm text-stone-500">Pendientes con fecha desde hoy</p>
            </div>
            <Link
              href={`/tutor?tab=agenda&sacar=1&mascota=${encodeURIComponent(chapitaId)}`}
              className={primaryBtnClass}
            >
              Sacar turno
            </Link>
          </div>
          {recordatoriosPerfil.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Sin recordatorios desde hoy.</p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {recordatoriosPerfil.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-aguara-orange">
                      {item.tipo}
                    </p>
                    <p className="font-medium text-aguara-ink">{item.title}</p>
                    {item.detail ? <p className="text-stone-500">{item.detail}</p> : null}
                  </div>
                  <p className="shrink-0 text-stone-600">
                    {item.dateLabel || (item.date ? formatDate(item.date) : "—")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {sinChapita ? (
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-aguara-ink">Vincular chapita</h2>
            <p className="mt-1 text-sm text-stone-500">
              Ingresá el código impreso en la chapita (o el del QR) para asociarla a esta mascota.
            </p>
            <form onSubmit={handleVincularChapita} className="mt-4 space-y-3">
              <Field label="Código de la chapita" id="perfil-codigo-chapita">
                <input
                  id="perfil-codigo-chapita"
                  required
                  placeholder="Ej: T2-015"
                  className={fieldClass}
                  value={codigoChapita}
                  onChange={(e) => setCodigoChapita(e.target.value)}
                />
              </Field>
              <button type="submit" disabled={linking} className={primaryBtnClass}>
                {linking ? "Vinculando…" : "Guardar código / vincular"}
              </button>
            </form>
          </section>
        ) : null}

        <section className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-aguara-ink">Datos básicos</h2>
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
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-stone-700">Castrado/a</span>
                <select
                  required
                  value={castrado}
                  onChange={(e) => setCastrado(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Elegí una opción</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                  <option value="ns">No lo sé</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-stone-700">Temperamento</span>
                <select
                  required
                  value={temperamento}
                  onChange={(e) => setTemperamento(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Elegí una opción</option>
                  {TEMPERAMENTOS_MASCOTA.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-stone-700">
                  Clínica de cabecera <span className="font-normal text-stone-500">(opcional)</span>
                </span>
                <select
                  value={clinicaCabeceraId}
                  onChange={(e) => setClinicaCabeceraId(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Sin clínica de cabecera</option>
                  {clinicas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                      {c.ciudad ? ` · ${c.ciudad}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={saving} className={`${primaryBtnClass} sm:col-span-2`}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </form>
          ) : (
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
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
              <div>
                <dt className="text-stone-500">Castrado/a</dt>
                <dd className="font-medium text-aguara-ink">
                  {perfil.castrado === true
                    ? "Sí"
                    : perfil.castrado === false
                      ? "No"
                      : "No lo sé"}
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">Temperamento</dt>
                <dd className="font-medium text-aguara-ink">{perfil.temperamento || "—"}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Clínica de cabecera</dt>
                <dd className="font-medium text-aguara-ink">
                  {perfil.clinica_cabecera?.nombre
                    ? `${perfil.clinica_cabecera.nombre}${
                        perfil.clinica_cabecera.ciudad
                          ? ` · ${perfil.clinica_cabecera.ciudad}`
                          : ""
                      }`
                    : "—"}
                </dd>
              </div>
            </dl>
          )}
        </section>

        <VacunasPerfilSection
          tutor={tutor}
          perfil={perfil}
          chapitaId={chapitaId}
          onChanged={async () => {
            const next = await cargarPerfilClinicoMascota(chapitaId);
            setPerfil(next);
          }}
        />

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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-aguara-ink">Próxima cita</h2>
            <Link
              href={`/tutor?tab=agenda&sacar=1&mascota=${encodeURIComponent(chapitaId)}`}
              className={primaryBtnClass}
            >
              Sacar turno
            </Link>
          </div>
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

        <TratamientosPerfilSection
          tutor={tutor}
          perfil={perfil}
          chapitaId={chapitaId}
          onChanged={async () => {
            const next = await cargarPerfilClinicoMascota(chapitaId);
            setPerfil(next);
          }}
        />
      </div>
    </section>
  );
}

function VacunasPerfilSection({ tutor, perfil, chapitaId, onChanged }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    fecha: new Date().toISOString().slice(0, 10),
  });

  async function handleSubmit(event) {
    event.preventDefault();
    if (!tutor?.id) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await crearVacunaTutor(tutor.id, {
        mascota_id: chapitaId,
        paciente_id: perfil.pacienteIds?.[0] || null,
        nombre: form.nombre,
        fecha: form.fecha,
      });
      setForm({
        nombre: "",
        fecha: new Date().toISOString().slice(0, 10),
      });
      setMessage("Vacuna agregada.");
      setShowAdd(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la vacuna.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cardClass}>
      <h2 className="text-lg font-semibold text-aguara-ink">Vacunas</h2>

      {perfil.vacunas.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">Todavía no hay vacunas registradas.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {perfil.vacunas.map((v) => (
            <li
              key={`${v.origen || "clinica"}-${v.id}`}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-aguara-cream/40 px-3 py-2"
            >
              <div>
                <strong>{v.nombre}</strong> · {formatDate(v.fecha)}
                {esVacunaVencida(v) ? (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">
                    Vencida
                  </span>
                ) : null}
                {v.origen === "tutor" ? (
                  <span className="ml-1 text-xs text-aguara-orange">(cargada por vos)</span>
                ) : (
                  <span className="ml-1 text-xs text-stone-500">(cargada por la clínica)</span>
                )}
                {v.proxima_fecha ? (
                  <span className="block text-aguara-orange">
                    Próxima: {formatDate(v.proxima_fecha)}
                  </span>
                ) : null}
              </div>
              {v.origen === "tutor" && tutor?.id ? (
                <button
                  type="button"
                  className="text-xs text-stone-500 underline"
                  onClick={async () => {
                    try {
                      await eliminarVacunaTutor(tutor.id, v.id);
                      await onChanged();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
                    }
                  }}
                >
                  Quitar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-aguara-orange hover:underline"
        aria-expanded={showAdd}
        onClick={() => {
          setShowAdd((v) => !v);
          setError("");
          setMessage("");
        }}
      >
        <span aria-hidden className={`inline-block transition-transform ${showAdd ? "rotate-90" : ""}`}>
          ›
        </span>
        {showAdd ? "Ocultar formulario" : "Agregar vacuna"}
      </button>

      {showAdd ? (
        <form onSubmit={handleSubmit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Field label="Vacuna" id="perf-vac-nom">
            <select
              id="perf-vac-nom"
              required
              className={fieldClass}
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            >
              <option value="">Seleccionar…</option>
              {vacunasParaEspecie(perfil.especie).map((nombre) => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha" id="perf-vac-fecha">
            <input
              id="perf-vac-fecha"
              type="date"
              required
              className={fieldClass}
              value={form.fecha}
              onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
            />
          </Field>
          <div className="flex items-end">
            <button type="submit" disabled={saving} className={primaryBtnClass}>
              {saving ? "…" : "Agregar"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
    </section>
  );
}

function TratamientosPerfilSection({ tutor, perfil, chapitaId, onChanged }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    detalle: "",
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_fin: "",
    de_por_vida: false,
  });

  async function handleSubmit(event) {
    event.preventDefault();
    if (!tutor?.id) return;
    if (!(await confirmGuardar(`el tratamiento “${form.titulo.trim()}”`))) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await crearTratamientoTutor(tutor.id, {
        mascota_id: chapitaId,
        paciente_id: perfil.pacienteIds?.[0] || null,
        titulo: form.titulo,
        detalle: form.detalle,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        de_por_vida: form.de_por_vida,
      });
      setForm({
        titulo: "",
        detalle: "",
        fecha_inicio: new Date().toISOString().slice(0, 10),
        fecha_fin: "",
        de_por_vida: false,
      });
      setMessage("Tratamiento agregado.");
      setShowAdd(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el tratamiento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cardClass}>
      <h2 className="text-lg font-semibold text-aguara-ink">Tratamientos activos</h2>

      {(perfil.tratamientos || []).length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">Sin tratamientos activos.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {(perfil.tratamientos || []).map((t) => (
            <li
              key={`${t.origen || "clinica"}-${t.id}`}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-aguara-cream/40 px-3 py-2"
            >
              <div>
                <strong>{t.titulo}</strong>
                {t.origen === "tutor" ? (
                  <span className="ml-1 text-xs text-aguara-orange">(cargado por vos)</span>
                ) : (
                  <span className="ml-1 text-xs text-stone-500">
                    (cargado por {t.clinica_nombre || "la clínica"})
                  </span>
                )}
                {t.detalle ? <span className="block text-stone-600">{t.detalle}</span> : null}
                <span className="mt-1 block text-stone-500">
                  Desde {formatDate(t.fecha_inicio)}
                  {t.de_por_vida
                    ? " · De por vida"
                    : t.fecha_fin
                      ? ` · Hasta ${formatDate(t.fecha_fin)}`
                      : ""}
                </span>
              </div>
              {t.origen === "tutor" && tutor?.id ? (
                <button
                  type="button"
                  className="text-xs text-stone-500 underline"
                  onClick={async () => {
                    if (!(await confirmEliminar(`el tratamiento “${t.titulo}”`))) return;
                    try {
                      await eliminarTratamientoTutor(tutor.id, t.id);
                      await onChanged();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
                    }
                  }}
                >
                  Quitar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-aguara-orange hover:underline"
        aria-expanded={showAdd}
        onClick={() => {
          setShowAdd((v) => !v);
          setError("");
          setMessage("");
        }}
      >
        <span aria-hidden className={`inline-block transition-transform ${showAdd ? "rotate-90" : ""}`}>
          ›
        </span>
        {showAdd ? "Ocultar formulario" : "Agregar tratamiento"}
      </button>

      {showAdd ? (
        <form onSubmit={handleSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Tratamiento" id="perf-tx-titulo" className="sm:col-span-2">
            <input
              id="perf-tx-titulo"
              required
              className={fieldClass}
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              placeholder="Nombre del tratamiento"
            />
          </Field>
          <Field label="Detalle / indicaciones" id="perf-tx-det" className="sm:col-span-2">
            <input
              id="perf-tx-det"
              className={fieldClass}
              value={form.detalle}
              onChange={(e) => setForm((f) => ({ ...f, detalle: e.target.value }))}
              placeholder="Opcional"
            />
          </Field>
          <Field label="Inicio" id="perf-tx-ini">
            <input
              id="perf-tx-ini"
              type="date"
              required
              className={fieldClass}
              value={form.fecha_inicio}
              onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
            />
          </Field>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={form.de_por_vida}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    de_por_vida: e.target.checked,
                    fecha_fin: e.target.checked ? "" : f.fecha_fin,
                  }))
                }
              />
              De por vida
            </label>
            {!form.de_por_vida ? (
              <input
                type="date"
                className={fieldClass}
                value={form.fecha_fin}
                onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))}
                title="Fecha de finalización"
                placeholder="Fin"
              />
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className={primaryBtnClass}>
              {saving ? "…" : "Agregar tratamiento"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
    </section>
  );
}
