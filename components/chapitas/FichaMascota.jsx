'use client';

import { useEffect, useState } from 'react';
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
import { listarMascotasDelTutor } from '@/lib/chapitas/tutores';

function FichaMascota() {
  const params = useParams();
  const raw = Array.isArray(params.id) ? params.id.join('/') : params.id;
  const rawId = extractChapitaIdFromRoute(raw || '');
  const chapitaId = normalizeChapitaId(rawId);

  const [mascota, setMascota] = useState(null);
  const [otrasMascotas, setOtrasMascotas] = useState([]);
  const [canActivate, setCanActivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!mascota && chapitaId && canActivate) {
      document.title = `Activar Chapita ${chapitaId} - Aguará App`;
    } else if (mascota) {
      document.title = `${mascota.nombre_mascota} - Chapita Aguará`;
    }
  }, [mascota, chapitaId, canActivate]);

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

      if (data) {
        setCanActivate(false);
        if (data.tutor_id) {
          const siblings = await listarMascotasDelTutor(data.tutor_id);
          setOtrasMascotas(siblings.filter((item) => item.id !== data.id));
        } else {
          setOtrasMascotas([]);
        }
        setLoading(false);
        return;
      }

      setOtrasMascotas([]);

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

  if (!chapitaId) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-orange-700 mb-4">Chapita no válida</h1>
        <p className="text-gray-600 mb-6">
          El identificador ingresado no es válido. Verificá el código grabado en la chapita.
        </p>
        <Link href="/" className="text-orange-600 underline hover:text-orange-800">
          Volver al inicio
        </Link>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16">
        <p className="text-gray-600 animate-pulse">Cargando información...</p>
      </section>
    );
  }

  if (fetchError) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-orange-700 mb-4">Error al cargar la ficha</h1>
        <p className="text-gray-600 mb-6">
          No pudimos consultar la base de datos. Intentá nuevamente en unos minutos.
        </p>
        <Link href="/" className="text-orange-600 underline hover:text-orange-800">
          Volver al inicio
        </Link>
      </section>
    );
  }

  if (!mascota && !canActivate) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-orange-700 mb-4">Chapita no registrada</h1>
        <p className="text-gray-600 mb-6">
          El código <strong>{chapitaId}</strong> no está habilitado para activación. Si es tuya,
          contactá a Aguará para generar una chapita válida.
        </p>
        <Link href="/" className="text-orange-600 underline hover:text-orange-800">
          Volver al inicio
        </Link>
      </section>
    );
  }

  if (!mascota) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-orange-700 mb-4 text-center">
          Chapita Aguará
        </h1>
        <p className="text-gray-600 text-center max-w-2xl mx-auto">
          Esta chapita (ID: <strong>{chapitaId}</strong>) aún no fue activada. Completá el
          formulario con los datos del tutor y del animal.
        </p>
        <ActivarChapitaForm chapitaId={chapitaId} onActivated={setMascota} />
        <p className="mt-6 text-center">
          <Link href="/" className="text-orange-600 underline hover:text-orange-800">
            Volver al inicio
          </Link>
        </p>
      </section>
    );
  }

  const whatsappPhone = mascota.telefono_contacto.replace(/\D/g, '');

  return (
    <section className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <div className="rounded-lg bg-white p-6 sm:p-8 shadow-md">
        <div className="flex items-start gap-4 mb-6">
          {mascota.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mascota.foto_url}
              alt={mascota.nombre_mascota}
              className="size-20 rounded-full object-cover ring-2 ring-orange-100"
            />
          ) : (
            <div className="grid size-20 place-items-center rounded-full bg-orange-50 text-2xl font-semibold text-orange-700">
              {mascota.nombre_mascota?.charAt(0)?.toUpperCase() || '·'}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-orange-700">{mascota.nombre_mascota}</h1>
            <p className="text-gray-500 mt-1">Chapita Aguará · ID {mascota.id}</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <p>
            <strong>Especie:</strong> {mascota.especie}
          </p>
          {mascota.raza && (
            <p>
              <strong>Raza:</strong> {mascota.raza}
            </p>
          )}
          {mascota.sexo && (
            <p>
              <strong>Sexo:</strong> {mascota.sexo}
            </p>
          )}
          {mascota.castrado !== null && mascota.castrado !== undefined && (
            <p>
              <strong>Castrado:</strong> {mascota.castrado ? 'Sí' : 'No'}
            </p>
          )}
          {mascota.nro_chip && (
            <p>
              <strong>N° de chip:</strong> {mascota.nro_chip}
            </p>
          )}
        </div>

        <hr className="my-6 border-gray-200" />

        <h2 className="text-xl font-semibold text-orange-700 mb-3">Datos del tutor</h2>
        <p className="mb-2">
          <strong>Tutor:</strong> {mascota.nombre_dueno}
        </p>
        {mascota.email_tutor && (
          <p className="mb-2">
            <strong>Email:</strong>{' '}
            <a href={`mailto:${mascota.email_tutor}`} className="text-orange-600 hover:underline">
              {mascota.email_tutor}
            </a>
          </p>
        )}
        <p className="mb-2">
          <strong>Número de contacto:</strong>{' '}
          <a href={`tel:${mascota.telefono_contacto}`} className="text-orange-600 hover:underline">
            {mascota.telefono_contacto}
          </a>
        </p>
        {mascota.telefono_secundario && (
          <p className="mb-4">
            <strong>Contacto secundario:</strong>{' '}
            <a
              href={`tel:${mascota.telefono_secundario}`}
              className="text-orange-600 hover:underline"
            >
              {mascota.telefono_secundario}
            </a>
          </p>
        )}

        <a
          href={`https://wa.me/${whatsappPhone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-green-500 px-5 py-3 font-semibold text-white hover:bg-green-600 transition-colors"
        >
          Contactar por WhatsApp
        </a>

        {(mascota.enfermedad ||
          mascota.medicacion ||
          mascota.datos_adicionales ||
          mascota.observaciones_medicas) && (
          <>
            <hr className="my-6 border-gray-200" />
            <h2 className="text-xl font-semibold text-orange-700 mb-3">Información adicional</h2>
            {mascota.enfermedad && (
              <p className="mb-3 text-gray-700">
                <strong>Enfermedad:</strong> {mascota.enfermedad}
              </p>
            )}
            {mascota.medicacion && (
              <p className="mb-3 text-gray-700">
                <strong>Medicación:</strong> {mascota.medicacion}
              </p>
            )}
            {mascota.datos_adicionales && (
              <p className="mb-3 text-gray-700 whitespace-pre-wrap">
                <strong>Datos adicionales:</strong> {mascota.datos_adicionales}
              </p>
            )}
            {mascota.observaciones_medicas && (
              <p className="text-gray-700 whitespace-pre-wrap">
                <strong>Observaciones:</strong> {mascota.observaciones_medicas}
              </p>
            )}
          </>
        )}

        {otrasMascotas.length > 0 ? (
          <>
            <hr className="my-6 border-gray-200" />
            <h2 className="text-xl font-semibold text-orange-700 mb-3">
              Otras mascotas del mismo tutor
            </h2>
            <ul className="space-y-2">
              {otrasMascotas.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/mascota/${item.id}`}
                    className="flex items-center gap-3 rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-700 hover:border-orange-300 hover:bg-orange-50"
                  >
                    {item.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.foto_url}
                        alt=""
                        className="size-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="grid size-10 place-items-center rounded-full bg-orange-50 font-medium text-orange-700">
                        {item.nombre_mascota?.charAt(0)?.toUpperCase() || '·'}
                      </span>
                    )}
                    <span>
                      <span className="font-medium text-stone-900">{item.nombre_mascota}</span>
                      {item.especie ? (
                        <span className="block text-stone-500">{item.especie}</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <p className="mt-8 text-center">
        <Link href="/" className="text-orange-600 underline hover:text-orange-800">
          Aguará App
        </Link>
      </p>
    </section>
  );
}

export default FichaMascota;
