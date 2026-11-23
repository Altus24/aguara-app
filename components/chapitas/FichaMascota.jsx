'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  supabase,
  normalizeChapitaId,
  isDynamicChapitaId,
  isFirstTiradaFreeActivation,
  isTiradaChapitaId,
  parseChapitaTirada,
  getChapitaLookupIds,
  extractChapitaIdFromRoute,
} from '@/lib/chapitas/supabaseClient';
import ActivarChapitaForm from './ActivarChapitaForm';

function etiquetaCastrado(mascota) {
  if (mascota.castrado === true) {
    return mascota.sexo === 'Hembra' ? 'Castrada' : 'Castrado';
  }
  if (mascota.castrado === false) {
    return mascota.sexo === 'Hembra' ? 'No castrada' : 'No castrado';
  }
  return null;
}

function buildSubtitle(mascota) {
  const parts = [];
  if (mascota.raza) parts.push(mascota.raza);
  else if (mascota.especie) parts.push(mascota.especie);
  const castrado = etiquetaCastrado(mascota);
  if (castrado) parts.push(castrado);
  return parts.join(', ');
}

function WhatsAppIcon({ className = 'size-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function PhoneIcon({ className = 'size-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
      />
    </svg>
  );
}

function PinIcon({ className = 'size-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
      />
    </svg>
  );
}

function WarningIcon({ className = 'size-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9.401 1.5c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 1.5zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PillIcon({ className = 'size-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5m14.25-6.438l-3.75 3.75m-4.5-4.5l-3.75 3.75M19.5 9.75l-7.5 7.5a2.121 2.121 0 01-3 0l-2.25-2.25a2.121 2.121 0 010-3l7.5-7.5a2.121 2.121 0 013 0l2.25 2.25a2.121 2.121 0 010 3z"
      />
    </svg>
  );
}

function FichaMascota() {
  const params = useParams();
  const raw = Array.isArray(params.id) ? params.id.join('/') : params.id;
  const rawId = extractChapitaIdFromRoute(raw || '');
  const chapitaId = normalizeChapitaId(rawId);

  const [mascota, setMascota] = useState(null);
  const [clinicaCabecera, setClinicaCabecera] = useState(null);
  const [canActivate, setCanActivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [gpsMsg, setGpsMsg] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    if (!mascota && chapitaId && canActivate) {
      document.title = `Activar identificador ${chapitaId} - Aguará App`;
    } else if (mascota) {
      document.title = `${mascota.nombre_mascota} - Identificador Aguará`;
    }
  }, [mascota, chapitaId, canActivate]);

  // Escaneo público: IP → ubicación aproximada → aviso al tutor (sin GPS del navegador).
  useEffect(() => {
    if (!mascota?.id) return;

    const storageKey = `aguara_escaneo_${mascota.id}`;
    try {
      if (typeof window !== 'undefined' && sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }

    (async () => {
      try {
        await fetch('/api/chapitas/escaneo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mascotaId: mascota.id }),
          keepalive: true,
        });
      } catch {
        /* el aviso al tutor no debe romper la ficha pública */
      }
    })();
  }, [mascota?.id]);

  useEffect(() => {
    if (!chapitaId) {
      setLoading(false);
      return;
    }

    async function fetchMascota() {
      setLoading(true);
      setFetchError(false);

      const lookupIds = getChapitaLookupIds(chapitaId);
      const { data: mascotaRows, error } = await supabase
        .from('mascotas')
        .select('*')
        .in('id', lookupIds);
      const data = mascotaRows?.[0] ?? null;

      if (error) {
        setFetchError(true);
        setMascota(null);
        setCanActivate(false);
        setLoading(false);
        return;
      }

      setMascota(data);
      setClinicaCabecera(null);

      if (data) {
        if (data.clinica_cabecera_id) {
          const { data: clinica } = await supabase
            .from('clinicas')
            .select('id, nombre, direccion, telefono, ciudad')
            .eq('id', data.clinica_cabecera_id)
            .maybeSingle();
          setClinicaCabecera(clinica || null);
        }
        setCanActivate(false);
        setLoading(false);
        return;
      }

      if (isFirstTiradaFreeActivation(chapitaId)) {
        setCanActivate(true);
        setLoading(false);
        return;
      }

      if (isDynamicChapitaId(chapitaId) || isTiradaChapitaId(chapitaId)) {
        const parsed = parseChapitaTirada(chapitaId);
        const lookupId = chapitaId;

        const { data: chapitaData, error: chapitaError } = await supabase
          .from('chapitas')
          .select('id')
          .eq('id', lookupId)
          .maybeSingle();

        if (chapitaError) {
          setFetchError(true);
          setCanActivate(false);
        } else if (chapitaData) {
          setCanActivate(true);
        } else if (parsed && !parsed.web && parsed.tirada > 1) {
          const { data: altData } = await supabase
            .from('chapitas')
            .select('id')
            .ilike('id', lookupId)
            .maybeSingle();
          setCanActivate(Boolean(altData));
        } else {
          setCanActivate(false);
        }
      } else {
        setCanActivate(false);
      }

      setLoading(false);
    }

    fetchMascota();
  }, [chapitaId]);

  const whatsappPhone = useMemo(() => {
    if (!mascota?.telefono_contacto) return '';
    const digits = String(mascota.telefono_contacto).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('54')) return digits;
    if (digits.startsWith('0')) return `54${digits.slice(1)}`;
    return digits.length <= 10 ? `549${digits}` : digits;
  }, [mascota?.telefono_contacto]);

  const subtitle = mascota ? buildSubtitle(mascota) : '';
  const clinicaNombre = clinicaCabecera?.nombre || mascota?.clinica_ref_nombre || null;
  const clinicaDireccion =
    [clinicaCabecera?.direccion, clinicaCabecera?.ciudad].filter(Boolean).join(' · ') ||
    mascota?.clinica_ref_direccion ||
    null;
  const clinicaTelefono = clinicaCabecera?.telefono || mascota?.clinica_ref_telefono || null;

  function handleShareGps() {
    setGpsMsg('');
    if (!navigator.geolocation) {
      setGpsMsg('Tu navegador no permite compartir ubicación.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
        const text = `Hola, encontré a ${mascota.nombre_mascota}. Mi ubicación aproximada: ${mapsUrl}`;
        setGpsLoading(false);
        if (whatsappPhone) {
          window.open(
            `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(text)}`,
            '_blank',
            'noopener,noreferrer',
          );
          return;
        }
        if (navigator.share) {
          navigator.share({ title: mascota.nombre_mascota, text, url: mapsUrl }).catch(() => {
            setGpsMsg(mapsUrl);
          });
          return;
        }
        setGpsMsg(mapsUrl);
      },
      () => {
        setGpsLoading(false);
        setGpsMsg('No pudimos obtener tu ubicación. Revisá los permisos del navegador.');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  if (!chapitaId) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-4 text-xl font-semibold text-aguara-orange">Identificador no válido</h1>
        <p className="mb-6 text-stone-600">
          El identificador ingresado no es válido. Verificá el código grabado en el identificador.
        </p>
        <Link href="/" className="text-aguara-orange underline hover:text-aguara-orange-deep">
          Volver al inicio
        </Link>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16">
        <p className="animate-pulse text-stone-600">Cargando información…</p>
      </section>
    );
  }

  if (fetchError) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-4 text-xl font-semibold text-aguara-orange">Error al cargar la ficha</h1>
        <p className="mb-6 text-stone-600">
          No pudimos consultar la base de datos. Intentá nuevamente en unos minutos.
        </p>
        <Link href="/" className="text-aguara-orange underline hover:text-aguara-orange-deep">
          Volver al inicio
        </Link>
      </section>
    );
  }

  if (!mascota && !canActivate) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-4 text-xl font-semibold text-aguara-orange">Identificador no registrado</h1>
        <p className="mb-6 text-stone-600">
          El código <strong>{chapitaId}</strong> no está habilitado para activación. Si es tuya,
          contactá a Aguará para generar un identificador válido.
        </p>
        <Link href="/" className="text-aguara-orange underline hover:text-aguara-orange-deep">
          Volver al inicio
        </Link>
      </section>
    );
  }

  if (!mascota) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <h1 className="mb-4 text-center text-3xl font-bold text-aguara-orange sm:text-4xl">
          Identificador Aguará
        </h1>
        <p className="mx-auto max-w-2xl text-center text-stone-600">
          Este identificador (ID: <strong>{chapitaId}</strong>) aún no fue activado. Completá el
          formulario con los datos del tutor y del animal.
        </p>
        <ActivarChapitaForm chapitaId={chapitaId} onActivated={setMascota} />
        <p className="mt-6 text-center">
          <Link href="/" className="text-aguara-orange underline hover:text-aguara-orange-deep">
            Volver al inicio
          </Link>
        </p>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-aguara-mist via-aguara-paper to-white">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Aguará" width={36} height={36} className="size-9 object-contain" />
            <span className="text-lg font-bold tracking-tight text-aguara-ink">Aguará App</span>
          </Link>
          <Link
            href="/tutor/login"
            className="rounded-full border border-aguara-orange/40 px-3.5 py-1.5 text-sm font-medium text-aguara-orange hover:bg-aguara-orange/5"
          >
            Acceso Tutor
          </Link>
        </div>
      </header>

      <div
        className={`px-4 py-3 text-center text-sm font-semibold text-white shadow-sm ${
          mascota.perdida ? 'bg-red-600' : 'bg-aguara-orange'
        }`}
      >
        {mascota.perdida
          ? `¡${mascota.nombre_mascota || 'Esta mascota'} está perdida! Contactá al tutor`
          : 'Si encontraste esta mascota — ayudanos a reencontrarla con su tutor'}
      </div>

      <main className="mx-auto max-w-lg px-4 py-6 pb-12">
        <article className="overflow-hidden rounded-3xl bg-white shadow-[0_12px_40px_rgba(26,19,17,0.08)] ring-1 ring-stone-100">
          <div className="p-5 sm:p-6">
            {mascota.perdida ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center">
                <p className="text-sm font-bold uppercase tracking-wide text-red-800">
                  Mascota perdida
                </p>
                <p className="mt-1 text-sm text-red-900/80">
                  El tutor activó el aviso. Por favor contactalo y, si podés, compartí tu ubicación.
                </p>
              </div>
            ) : null}
            <div className="overflow-hidden rounded-2xl bg-aguara-mist">
              {mascota.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mascota.foto_url}
                  alt={mascota.nombre_mascota}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="grid aspect-square w-full place-items-center bg-gradient-to-br from-aguara-cream to-aguara-mist text-6xl font-bold text-aguara-orange">
                  {mascota.nombre_mascota?.charAt(0)?.toUpperCase() || '·'}
                </div>
              )}
            </div>

            <div className="mt-5 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-aguara-ink sm:text-4xl">
                {mascota.nombre_mascota}
              </h1>
              {subtitle ? <p className="mt-1.5 text-base text-stone-500">{subtitle}</p> : null}
              {mascota.temperamento ? (
                <p className="mt-1 text-sm text-stone-400">Temperamento: {mascota.temperamento}</p>
              ) : null}
            </div>

            {(mascota.enfermedad || mascota.medicacion) && (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {mascota.enfermedad ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-amber-500">
                        <WarningIcon className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-amber-800/80">Enfermedades</p>
                        <p className="mt-0.5 break-words font-semibold text-aguara-ink">
                          {mascota.enfermedad}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
                {mascota.medicacion ? (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3.5 py-3">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-sky-600">
                        <PillIcon className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-sky-800/80">Medicación</p>
                        <p className="mt-0.5 break-words font-semibold text-aguara-ink">
                          {mascota.medicacion}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="mt-6 space-y-3">
              {whatsappPhone ? (
                <a
                  href={`https://wa.me/${whatsappPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2.5 rounded-full bg-[#25D366] px-5 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#1ebe57]"
                >
                  <WhatsAppIcon />
                  Contactar al Tutor por WhatsApp
                </a>
              ) : null}

              {mascota.telefono_contacto ? (
                <a
                  href={`tel:${mascota.telefono_contacto}`}
                  className="flex w-full items-center justify-center gap-2.5 rounded-full border-2 border-aguara-orange bg-white px-5 py-3.5 text-base font-semibold text-aguara-orange transition hover:bg-aguara-orange/5"
                >
                  <PhoneIcon />
                  Llamar por Teléfono
                </a>
              ) : null}

              <button
                type="button"
                onClick={handleShareGps}
                disabled={gpsLoading}
                className="flex w-full items-center justify-center gap-2.5 rounded-full bg-stone-100 px-5 py-3.5 text-base font-semibold text-aguara-ink transition hover:bg-stone-200 disabled:opacity-60"
              >
                <PinIcon />
                {gpsLoading ? 'Obteniendo ubicación…' : 'Compartir mi Ubicación GPS'}
              </button>
              {gpsMsg ? (
                <p className="break-all text-center text-xs text-stone-500">{gpsMsg}</p>
              ) : null}
            </div>
          </div>
        </article>

        <section className="mt-5 space-y-3 rounded-3xl bg-white/80 p-5 shadow-sm ring-1 ring-stone-100 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
            Datos del tutor
          </h2>
          <p className="text-base font-medium text-aguara-ink">{mascota.nombre_dueno}</p>
          {mascota.telefono_secundario ? (
            <p className="text-sm text-stone-600">
              Contacto secundario:{' '}
              <a href={`tel:${mascota.telefono_secundario}`} className="font-medium text-aguara-orange">
                {mascota.telefono_secundario}
              </a>
            </p>
          ) : null}
          {mascota.email_tutor ? (
            <p className="text-sm text-stone-600">
              Email:{' '}
              <a href={`mailto:${mascota.email_tutor}`} className="font-medium text-aguara-orange">
                {mascota.email_tutor}
              </a>
            </p>
          ) : null}
        </section>

        {clinicaNombre ? (
          <section className="mt-3 space-y-2 rounded-3xl bg-white/80 p-5 shadow-sm ring-1 ring-stone-100 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
              Clínica de cabecera
            </h2>
            <p className="text-base font-medium text-aguara-ink">{clinicaNombre}</p>
            {clinicaDireccion ? <p className="text-sm text-stone-600">{clinicaDireccion}</p> : null}
            {clinicaTelefono ? (
              <a href={`tel:${clinicaTelefono}`} className="text-sm font-medium text-aguara-orange">
                {clinicaTelefono}
              </a>
            ) : null}
          </section>
        ) : null}

        {(mascota.nro_chip || mascota.datos_adicionales || mascota.observaciones_medicas) && (
          <section className="mt-3 space-y-2 rounded-3xl bg-white/80 p-5 shadow-sm ring-1 ring-stone-100 sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">
              Información adicional
            </h2>
            {mascota.nro_chip ? (
              <p className="text-sm text-stone-700">
                <span className="font-medium">N° de chip:</span> {mascota.nro_chip}
              </p>
            ) : null}
            {mascota.datos_adicionales ? (
              <p className="whitespace-pre-wrap text-sm text-stone-700">{mascota.datos_adicionales}</p>
            ) : null}
            {mascota.observaciones_medicas ? (
              <p className="whitespace-pre-wrap text-sm text-stone-700">
                {mascota.observaciones_medicas}
              </p>
            ) : null}
          </section>
        )}

        <p className="mt-6 text-center text-xs text-stone-400">Identificador {mascota.id}</p>
      </main>
    </div>
  );
}

export default FichaMascota;
