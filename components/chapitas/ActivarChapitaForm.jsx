'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import MascotaRegistroFields, {
  EMPTY_PET_FORM,
  validateMascotaRegistroForm,
} from '@/components/mascotas/MascotaRegistroFields';
import { confirmGuardar } from '@/lib/confirmAction';
import { supabase, getCanonicalInsertChapitaId } from '@/lib/chapitas/supabaseClient';
import { generateChapitaQrSvg } from '@/lib/chapitas/chapitaQr';
import { listarClinicas } from '@/lib/chapitas/tutorPortal';
import {
  buscarTutorPorContacto,
  crearTutor,
  normalizePhoneDigits,
} from '@/lib/chapitas/tutores';

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const initialTutorForm = {
  nombre_dueno: '',
  email_tutor: '',
  telefono_contacto: '',
  telefono_secundario: '',
  direccion: '',
};

const fieldClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500';

function ActivarChapitaForm({ chapitaId, onActivated }) {
  const [step, setStep] = useState(1);
  const [tutorMode, setTutorMode] = useState('nuevo');
  const [tutorForm, setTutorForm] = useState(initialTutorForm);
  const [petForm, setPetForm] = useState(EMPTY_PET_FORM);
  const [tutorSeleccionado, setTutorSeleccionado] = useState(null);
  const [mascotasTutor, setMascotasTutor] = useState([]);
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupTelefono, setLookupTelefono] = useState('');
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState('');
  const [clinicas, setClinicas] = useState([]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

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

  const handleTutorChange = (event) => {
    const { name, value } = event.target;
    setTutorForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePetField = (name, value) => {
    setPetForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoto = (event) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
      setFoto(null);
      setPreview(null);
      return;
    }
    if (!PHOTO_TYPES.has(file.type)) {
      setError('La foto tiene que ser JPG, PNG o WebP.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('La foto no puede superar 4 MB.');
      event.target.value = '';
      return;
    }
    setError('');
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setFoto(file);
    setPreview(url);
  };

  const uploadFoto = async (insertId) => {
    if (!foto) return null;
    const extension =
      foto.type === 'image/png' ? 'png' : foto.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${insertId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('mascotas-fotos')
      .upload(path, foto, { contentType: foto.type, upsert: false });
    if (uploadError) {
      throw new Error(
        /bucket not found/i.test(uploadError.message)
          ? 'Falta el bucket mascotas-fotos. Ejecutá supabase/chapitas/07_mascotas_ficha_extendida.sql.'
          : 'No se pudo subir la foto. Intentá nuevamente.',
      );
    }
    const { data } = supabase.storage.from('mascotas-fotos').getPublicUrl(path);
    return data.publicUrl;
  };

  const validateTutorNuevo = () => {
    if (
      !tutorForm.nombre_dueno.trim() ||
      !tutorForm.email_tutor.trim() ||
      !tutorForm.telefono_contacto.trim()
    ) {
      setError('Completá los datos obligatorios del tutor.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tutorForm.email_tutor.trim())) {
      setError('Ingresá un email válido del tutor.');
      return false;
    }
    if (normalizePhoneDigits(tutorForm.telefono_contacto).length < 8) {
      setError('Ingresá un número de contacto válido.');
      return false;
    }
    if (
      tutorForm.telefono_secundario.trim() &&
      normalizePhoneDigits(tutorForm.telefono_secundario).length < 8
    ) {
      setError('El número de contacto secundario no es válido.');
      return false;
    }
    return true;
  };

  const validatePet = () => {
    const msg = validateMascotaRegistroForm(petForm);
    if (msg) {
      setError(msg);
      return false;
    }
    return true;
  };

  const handleBuscarTutor = async (event) => {
    event.preventDefault();
    setError('');
    if (!lookupEmail.trim() && normalizePhoneDigits(lookupTelefono).length < 8) {
      setError('Ingresá el email o el teléfono del tutor para buscarlo.');
      return;
    }

    setLookingUp(true);
    try {
      const result = await buscarTutorPorContacto({
        email: lookupEmail,
        telefono: lookupTelefono,
      });
      if (!result.tutor) {
        setTutorSeleccionado(null);
        setMascotasTutor([]);
        setError('No encontramos ese tutor. Creá uno nuevo o revisá los datos.');
        return;
      }
      setTutorSeleccionado(result.tutor);
      setMascotasTutor(result.mascotas);
      setTutorForm({
        nombre_dueno: result.tutor.nombre_completo || '',
        email_tutor: result.tutor.email || '',
        telefono_contacto: result.tutor.telefono || '',
        telefono_secundario: result.tutor.telefono_secundario || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo buscar el tutor.');
    } finally {
      setLookingUp(false);
    }
  };

  const goToPetStep = () => {
    setError('');
    if (tutorMode === 'existente') {
      if (!tutorSeleccionado) {
        setError('Buscá y seleccioná un tutor existente antes de continuar.');
        return;
      }
      setStep(2);
      return;
    }
    if (!validateTutorNuevo()) return;
    setStep(2);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!(await confirmGuardar('la activación de la chapita'))) return;
    setError('');
    if (!validatePet()) return;

    const insertId = getCanonicalInsertChapitaId(chapitaId);
    if (!insertId) {
      setError('Identificador de chapita no válido.');
      return;
    }

    setSubmitting(true);

    try {
      let tutor = tutorSeleccionado;
      if (tutorMode === 'nuevo' || !tutor) {
        if (!validateTutorNuevo()) {
          setSubmitting(false);
          setStep(1);
          return;
        }
        tutor = await crearTutor({
          nombreCompleto: tutorForm.nombre_dueno,
          email: tutorForm.email_tutor,
          telefono: tutorForm.telefono_contacto,
          telefonoSecundario: tutorForm.telefono_secundario,
          direccion: tutorForm.direccion,
        });
      }

      let qrSvg;
      try {
        qrSvg = await generateChapitaQrSvg(insertId);
      } catch {
        setError('No se pudo generar el código QR. Intentá nuevamente.');
        setSubmitting(false);
        return;
      }

      const fotoUrl = await uploadFoto(insertId);
      const tutorNombre = tutor.nombre_completo || tutorForm.nombre_dueno.trim();
      const tutorEmail = (tutor.email || tutorForm.email_tutor).trim().toLowerCase();
      const tutorTelefono = tutor.telefono || tutorForm.telefono_contacto.trim();
      const tutorTelefonoSec =
        tutor.telefono_secundario || tutorForm.telefono_secundario.trim() || null;

      const mascotaPayload = {
        id: insertId,
        tutor_id: tutor.id,
        nombre_mascota: petForm.nombre_mascota.trim(),
        especie: petForm.especie,
        raza: petForm.raza.trim() || null,
        sexo: petForm.sexo,
        castrado:
          petForm.castrado === 'si' ? true : petForm.castrado === 'no' ? false : null,
        temperamento: petForm.temperamento || null,
        fecha_nacimiento: petForm.fecha_nacimiento || null,
        peso: petForm.peso === '' ? null : Number(petForm.peso),
        nro_chip: petForm.nro_chip.trim() || null,
        enfermedad: petForm.enfermedad.trim() || null,
        medicacion: petForm.medicacion.trim() || null,
        datos_adicionales: petForm.datos_adicionales.trim() || null,
        clinica_cabecera_id: petForm.clinica_cabecera_id || null,
        clinica_ref_nombre: petForm.clinica_ref_nombre?.trim() || null,
        clinica_ref_direccion: petForm.clinica_ref_direccion?.trim() || null,
        clinica_ref_telefono: petForm.clinica_ref_telefono?.trim() || null,
        foto_url: fotoUrl,
        nombre_dueno: tutorNombre,
        email_tutor: tutorEmail,
        telefono_contacto: tutorTelefono,
        telefono_secundario: tutorTelefonoSec,
        qr_svg: qrSvg,
      };

      let { data, error: insertError } = await supabase
        .from('mascotas')
        .insert(mascotaPayload)
        .select()
        .single();

      const hasClinicaRef = Boolean(
        mascotaPayload.clinica_ref_nombre ||
          mascotaPayload.clinica_ref_direccion ||
          mascotaPayload.clinica_ref_telefono,
      );

      if (insertError && /temperamento/i.test(insertError.message || '')) {
        delete mascotaPayload.temperamento;
        ({ data, error: insertError } = await supabase
          .from('mascotas')
          .insert(mascotaPayload)
          .select()
          .single());
      }

      if (insertError && /clinica_ref_/i.test(insertError.message || '')) {
        if (hasClinicaRef) {
          throw new Error(
            'Faltan las columnas de clínica de referencia. Ejecutá supabase/chapitas/38_mascota_clinica_referencia.sql en Supabase y recargá el schema.',
          );
        }
        delete mascotaPayload.clinica_ref_nombre;
        delete mascotaPayload.clinica_ref_direccion;
        delete mascotaPayload.clinica_ref_telefono;
        ({ data, error: insertError } = await supabase
          .from('mascotas')
          .insert(mascotaPayload)
          .select()
          .single());
      }

      if (insertError && /clinica_cabecera/i.test(insertError.message || '')) {
        delete mascotaPayload.clinica_cabecera_id;
        ({ data, error: insertError } = await supabase
          .from('mascotas')
          .insert(mascotaPayload)
          .select()
          .single());
      }

      if (insertError && /fecha_nacimiento|peso/i.test(insertError.message || '')) {
        delete mascotaPayload.fecha_nacimiento;
        delete mascotaPayload.peso;
        ({ data, error: insertError } = await supabase
          .from('mascotas')
          .insert(mascotaPayload)
          .select()
          .single());
      }

      if (insertError) {
        if (insertError.code === '23505') {
          setError('Esta chapita ya fue activada.');
        } else if (/column|tutor_id|schema cache|does not exist/i.test(insertError.message || '')) {
          setError(
            'Faltan columnas de tutores. Ejecutá supabase/chapitas/09_tutores.sql en Supabase.',
          );
        } else {
          setError('No se pudo activar la chapita. Intentá nuevamente.');
        }
        setSubmitting(false);
        return;
      }

      onActivated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar el registro.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-8 max-w-xl space-y-6 rounded-lg bg-white p-6 shadow-md">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-orange-700 mb-2">Activar chapita {chapitaId}</h2>
        <p className="text-gray-600">
          Un mismo tutor puede vincular varias mascotas. Primero el tutor, después el animal.
        </p>
        <div className="mt-4 flex justify-center gap-2 text-sm">
          <span className={step === 1 ? 'font-semibold text-orange-700' : 'text-stone-400'}>
            1. Tutor
          </span>
          <span className="text-stone-300">→</span>
          <span className={step === 2 ? 'font-semibold text-orange-700' : 'text-stone-400'}>
            2. Mascota
          </span>
        </div>
      </div>

      {step === 1 ? (
        <section className="space-y-4">
          <h3 className="text-base font-semibold text-stone-900 border-b border-stone-200 pb-2">
            Datos del tutor
          </h3>

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
            <button
              type="button"
              className={`h-9 rounded-lg text-sm font-medium ${
                tutorMode === 'nuevo' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
              onClick={() => {
                setTutorMode('nuevo');
                setTutorSeleccionado(null);
                setMascotasTutor([]);
                setError('');
              }}
            >
              Tutor nuevo
            </button>
            <button
              type="button"
              className={`h-9 rounded-lg text-sm font-medium ${
                tutorMode === 'existente' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
              onClick={() => {
                setTutorMode('existente');
                setError('');
              }}
            >
              Tutor existente
            </button>
          </div>

          {tutorMode === 'existente' ? (
            <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm text-stone-600">
                Buscá por email o teléfono para vincular otra mascota al mismo tutor.
              </p>
              <div>
                <label htmlFor="lookup_email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email del tutor
                </label>
                <input
                  id="lookup_email"
                  type="email"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="lookup_telefono" className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono del tutor
                </label>
                <input
                  id="lookup_telefono"
                  type="tel"
                  value={lookupTelefono}
                  onChange={(e) => setLookupTelefono(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <button
                type="button"
                onClick={handleBuscarTutor}
                disabled={lookingUp}
                className="w-full rounded-md border border-orange-300 bg-white px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-60"
              >
                {lookingUp ? 'Buscando…' : 'Buscar tutor'}
              </button>

              {tutorSeleccionado ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <p className="font-semibold">{tutorSeleccionado.nombre_completo}</p>
                  <p className="mt-1">{tutorSeleccionado.email}</p>
                  <p>{tutorSeleccionado.telefono}</p>
                  {mascotasTutor.length > 0 ? (
                    <div className="mt-3">
                      <p className="font-medium">Mascotas ya vinculadas</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {mascotasTutor.map((m) => (
                          <li key={m.id}>
                            <Link href={`/mascota/${m.id}`} className="underline">
                              {m.nombre_mascota}
                            </Link>
                            {m.especie ? ` · ${m.especie}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-2">Todavía no tiene otras mascotas registradas.</p>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="nombre_dueno" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre y apellido *
                </label>
                <input
                  id="nombre_dueno"
                  name="nombre_dueno"
                  type="text"
                  required
                  value={tutorForm.nombre_dueno}
                  onChange={handleTutorChange}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="email_tutor" className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  id="email_tutor"
                  name="email_tutor"
                  type="email"
                  required
                  value={tutorForm.email_tutor}
                  onChange={handleTutorChange}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="telefono_contacto" className="block text-sm font-medium text-gray-700 mb-1">
                  Número de contacto *
                </label>
                <input
                  id="telefono_contacto"
                  name="telefono_contacto"
                  type="tel"
                  required
                  value={tutorForm.telefono_contacto}
                  onChange={handleTutorChange}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="telefono_secundario" className="block text-sm font-medium text-gray-700 mb-1">
                  Número de contacto secundario
                </label>
                <input
                  id="telefono_secundario"
                  name="telefono_secundario"
                  type="tel"
                  value={tutorForm.telefono_secundario}
                  onChange={handleTutorChange}
                  className={fieldClass}
                />
                <p className="mt-1 text-xs text-gray-500">Opcional</p>
              </div>
              <div>
                <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <input
                  id="direccion"
                  name="direccion"
                  type="text"
                  value={tutorForm.direccion}
                  onChange={handleTutorChange}
                  className={fieldClass}
                />
                <p className="mt-1 text-xs text-gray-500">Opcional</p>
              </div>
            </div>
          )}

          {error ? (
            <p className="text-red-600 text-sm text-center" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={goToPetStep}
            className="w-full rounded-md bg-orange-600 px-4 py-3 font-semibold text-white hover:bg-orange-700"
          >
            Continuar con la mascota
          </button>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-950">
            <p className="font-medium">Tutor</p>
            <p className="mt-1">
              {tutorSeleccionado?.nombre_completo || tutorForm.nombre_dueno} ·{' '}
              {tutorSeleccionado?.email || tutorForm.email_tutor}
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-orange-700 underline"
              onClick={() => {
                setError('');
                setStep(1);
              }}
            >
              Cambiar tutor
            </button>
          </div>

          <MascotaRegistroFields
            form={petForm}
            onChange={handlePetField}
            preview={preview}
            onPhoto={handlePhoto}
            fieldClass={fieldClass}
            fotoInputId="activar-foto"
            clinicas={clinicas}
          />

          {error ? (
            <p className="text-red-600 text-sm text-center" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-orange-600 px-4 py-3 font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {submitting ? 'Activando…' : 'Activar chapita'}
          </button>
        </section>
      )}
    </form>
  );
}

export default ActivarChapitaForm;
