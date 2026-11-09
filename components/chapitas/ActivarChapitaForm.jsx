'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase, getCanonicalInsertChapitaId } from '@/lib/chapitas/supabaseClient';
import { generateChapitaQrSvg } from '@/lib/chapitas/chapitaQr';

const ESPECIES = ['Perro', 'Gato'];
const SEXOS = ['Macho', 'Hembra'];
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const initialForm = {
  nombre_dueno: '',
  email_tutor: '',
  telefono_contacto: '',
  telefono_secundario: '',
  nombre_mascota: '',
  especie: 'Perro',
  raza: '',
  sexo: 'Macho',
  castrado: '',
  nro_chip: '',
  enfermedad: '',
  medicacion: '',
  datos_adicionales: '',
};

const fieldClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500';

function ActivarChapitaForm({ chapitaId, onActivated }) {
  const [form, setForm] = useState(initialForm);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (
      !form.nombre_mascota.trim() ||
      !form.nombre_dueno.trim() ||
      !form.email_tutor.trim() ||
      !form.telefono_contacto.trim() ||
      !form.sexo ||
      form.castrado === ''
    ) {
      setError('Completá los campos obligatorios.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email_tutor.trim())) {
      setError('Ingresá un email válido.');
      return;
    }

    const phoneDigits = form.telefono_contacto.replace(/\D/g, '');
    if (phoneDigits.length < 8) {
      setError('Ingresá un número de contacto válido.');
      return;
    }

    if (form.telefono_secundario.trim()) {
      const secondaryDigits = form.telefono_secundario.replace(/\D/g, '');
      if (secondaryDigits.length < 8) {
        setError('El número de contacto secundario no es válido.');
        return;
      }
    }

    const insertId = getCanonicalInsertChapitaId(chapitaId);
    if (!insertId) {
      setError('Identificador de chapita no válido.');
      return;
    }

    setSubmitting(true);

    let qrSvg;
    try {
      qrSvg = await generateChapitaQrSvg(insertId);
    } catch {
      setSubmitting(false);
      setError('No se pudo generar el código QR. Intentá nuevamente.');
      return;
    }

    let fotoUrl = null;
    try {
      fotoUrl = await uploadFoto(insertId);
    } catch (uploadErr) {
      setSubmitting(false);
      setError(uploadErr instanceof Error ? uploadErr.message : 'No se pudo subir la foto.');
      return;
    }

    const { data, error: insertError } = await supabase
      .from('mascotas')
      .insert({
        id: insertId,
        nombre_mascota: form.nombre_mascota.trim(),
        especie: form.especie,
        raza: form.raza.trim() || null,
        sexo: form.sexo,
        castrado: form.castrado === 'si',
        nro_chip: form.nro_chip.trim() || null,
        enfermedad: form.enfermedad.trim() || null,
        medicacion: form.medicacion.trim() || null,
        datos_adicionales: form.datos_adicionales.trim() || null,
        foto_url: fotoUrl,
        nombre_dueno: form.nombre_dueno.trim(),
        email_tutor: form.email_tutor.trim().toLowerCase(),
        telefono_contacto: form.telefono_contacto.trim(),
        telefono_secundario: form.telefono_secundario.trim() || null,
        qr_svg: qrSvg,
      })
      .select()
      .single();

    setSubmitting(false);

    if (insertError) {
      if (insertError.code === '23505') {
        setError('Esta chapita ya fue activada. Si necesitás modificar los datos, contactá a Aguará.');
      } else if (/column|schema cache|does not exist/i.test(insertError.message || '')) {
        setError(
          'Faltan columnas nuevas en Supabase. Ejecutá supabase/chapitas/07_mascotas_ficha_extendida.sql.',
        );
      } else {
        setError('No se pudo activar la chapita. Intentá nuevamente o contactanos por WhatsApp.');
      }
      return;
    }

    onActivated(data);
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-8 max-w-xl space-y-8 rounded-lg bg-white p-6 shadow-md">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-orange-700 mb-2">Activar chapita {chapitaId}</h2>
        <p className="text-gray-600">
          Completá los datos del tutor y del animal para vincular esta chapita.
        </p>
      </div>

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-stone-900 border-b border-stone-200 pb-2">
          Datos del tutor
        </h3>

        <div>
          <label htmlFor="nombre_dueno" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre y apellido *
          </label>
          <input
            id="nombre_dueno"
            name="nombre_dueno"
            type="text"
            required
            value={form.nombre_dueno}
            onChange={handleChange}
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
            autoComplete="email"
            value={form.email_tutor}
            onChange={handleChange}
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
            value={form.telefono_contacto}
            onChange={handleChange}
            placeholder="2615760216"
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
            value={form.telefono_secundario}
            onChange={handleChange}
            className={fieldClass}
          />
          <p className="mt-1 text-xs text-gray-500">Opcional</p>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-stone-900 border-b border-stone-200 pb-2">
          Datos del animal
        </h3>

        <div>
          <label htmlFor="nombre_mascota" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre *
          </label>
          <input
            id="nombre_mascota"
            name="nombre_mascota"
            type="text"
            required
            value={form.nombre_mascota}
            onChange={handleChange}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="foto" className="block text-sm font-medium text-gray-700 mb-1">
            Foto
          </label>
          <input
            id="foto"
            name="foto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhoto}
            className={`${fieldClass} py-2 file:mr-3 file:rounded-full file:border-0 file:bg-orange-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-orange-800`}
          />
          <p className="mt-1 text-xs text-gray-500">JPG, PNG o WebP. Hasta 4 MB.</p>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Vista previa" className="mt-3 size-24 rounded-full object-cover" />
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="especie" className="block text-sm font-medium text-gray-700 mb-1">
              Especie *
            </label>
            <select
              id="especie"
              name="especie"
              value={form.especie}
              onChange={handleChange}
              className={fieldClass}
            >
              {ESPECIES.map((especie) => (
                <option key={especie} value={especie}>
                  {especie}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="raza" className="block text-sm font-medium text-gray-700 mb-1">
              Raza
            </label>
            <input
              id="raza"
              name="raza"
              type="text"
              value={form.raza}
              onChange={handleChange}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="sexo" className="block text-sm font-medium text-gray-700 mb-1">
              Sexo *
            </label>
            <select id="sexo" name="sexo" value={form.sexo} onChange={handleChange} className={fieldClass}>
              {SEXOS.map((sexo) => (
                <option key={sexo} value={sexo}>
                  {sexo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="castrado" className="block text-sm font-medium text-gray-700 mb-1">
              Castrado *
            </label>
            <select
              id="castrado"
              name="castrado"
              value={form.castrado}
              onChange={handleChange}
              required
              className={fieldClass}
            >
              <option value="">Elegí una opción</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="nro_chip" className="block text-sm font-medium text-gray-700 mb-1">
            N° de chip
          </label>
          <input
            id="nro_chip"
            name="nro_chip"
            type="text"
            value={form.nro_chip}
            onChange={handleChange}
            className={fieldClass}
          />
          <p className="mt-1 text-xs text-gray-500">Opcional, si tiene</p>
        </div>

        <div>
          <label htmlFor="enfermedad" className="block text-sm font-medium text-gray-700 mb-1">
            ¿Posee alguna enfermedad? ¿Cuál?
          </label>
          <textarea
            id="enfermedad"
            name="enfermedad"
            rows={2}
            value={form.enfermedad}
            onChange={handleChange}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="medicacion" className="block text-sm font-medium text-gray-700 mb-1">
            ¿Toma alguna medicación?
          </label>
          <textarea
            id="medicacion"
            name="medicacion"
            rows={2}
            value={form.medicacion}
            onChange={handleChange}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="datos_adicionales" className="block text-sm font-medium text-gray-700 mb-1">
            Datos adicionales
          </label>
          <textarea
            id="datos_adicionales"
            name="datos_adicionales"
            rows={4}
            value={form.datos_adicionales}
            onChange={handleChange}
            placeholder="Todo lo que quieras que sepa quien encuentre a tu mascota."
            className={fieldClass}
          />
        </div>
      </section>

      {error && (
        <p className="text-red-600 text-sm text-center" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-orange-600 px-4 py-3 font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
      >
        {submitting ? 'Activando...' : 'Activar chapita'}
      </button>
    </form>
  );
}

export default ActivarChapitaForm;
