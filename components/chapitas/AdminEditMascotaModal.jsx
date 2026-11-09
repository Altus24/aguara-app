"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/chapitas/supabaseClient';

const ESPECIES = ['Perro', 'Gato'];
const SEXOS = ['Macho', 'Hembra'];

const fieldClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500';

function AdminEditMascotaModal({ mascota, onClose, onSaved }) {
  const [form, setForm] = useState({
    nombre_mascota: '',
    especie: 'Perro',
    raza: '',
    sexo: 'Macho',
    castrado: 'no',
    nro_chip: '',
    enfermedad: '',
    medicacion: '',
    datos_adicionales: '',
    nombre_dueno: '',
    email_tutor: '',
    telefono_contacto: '',
    telefono_secundario: '',
    foto_url: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!mascota) return;
    setForm({
      nombre_mascota: mascota.nombre_mascota || '',
      especie: mascota.especie === 'Gato' ? 'Gato' : 'Perro',
      raza: mascota.raza || '',
      sexo: mascota.sexo === 'Hembra' ? 'Hembra' : 'Macho',
      castrado: mascota.castrado ? 'si' : 'no',
      nro_chip: mascota.nro_chip || '',
      enfermedad: mascota.enfermedad || '',
      medicacion: mascota.medicacion || '',
      datos_adicionales: mascota.datos_adicionales || '',
      nombre_dueno: mascota.nombre_dueno || '',
      email_tutor: mascota.email_tutor || '',
      telefono_contacto: mascota.telefono_contacto || '',
      telefono_secundario: mascota.telefono_secundario || '',
      foto_url: mascota.foto_url || '',
    });
    setError('');
  }, [mascota]);

  if (!mascota) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (
      !form.nombre_mascota.trim() ||
      !form.nombre_dueno.trim() ||
      !form.email_tutor.trim() ||
      !form.telefono_contacto.trim()
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

    setSubmitting(true);

    const { data, error: updateError } = await supabase
      .from('mascotas')
      .update({
        nombre_mascota: form.nombre_mascota.trim(),
        especie: form.especie,
        raza: form.raza.trim() || null,
        sexo: form.sexo,
        castrado: form.castrado === 'si',
        nro_chip: form.nro_chip.trim() || null,
        enfermedad: form.enfermedad.trim() || null,
        medicacion: form.medicacion.trim() || null,
        datos_adicionales: form.datos_adicionales.trim() || null,
        foto_url: form.foto_url.trim() || null,
        nombre_dueno: form.nombre_dueno.trim(),
        email_tutor: form.email_tutor.trim().toLowerCase(),
        telefono_contacto: form.telefono_contacto.trim(),
        telefono_secundario: form.telefono_secundario.trim() || null,
      })
      .eq('id', mascota.id)
      .select()
      .single();

    setSubmitting(false);

    if (updateError) {
      setError(
        /column|schema cache|does not exist/i.test(updateError.message || '')
          ? 'Faltan columnas nuevas. Ejecutá supabase/chapitas/07_mascotas_ficha_extendida.sql.'
          : 'No se pudo guardar los cambios. Verificá tu sesión de superadmin.',
      );
      return;
    }

    onSaved(data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-mascota-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-mascota-title" className="text-xl font-semibold text-orange-700">
              Editar ficha
            </h2>
            <p className="text-sm text-gray-500 mt-1">Chapita ID: {mascota.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-stone-900 border-b pb-2">Datos del tutor</h3>
            <div>
              <label htmlFor="edit_nombre_dueno" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre y apellido *
              </label>
              <input
                id="edit_nombre_dueno"
                name="nombre_dueno"
                type="text"
                required
                value={form.nombre_dueno}
                onChange={handleChange}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="edit_email_tutor" className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                id="edit_email_tutor"
                name="email_tutor"
                type="email"
                required
                value={form.email_tutor}
                onChange={handleChange}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="edit_telefono_contacto" className="block text-sm font-medium text-gray-700 mb-1">
                Número de contacto *
              </label>
              <input
                id="edit_telefono_contacto"
                name="telefono_contacto"
                type="tel"
                required
                value={form.telefono_contacto}
                onChange={handleChange}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="edit_telefono_secundario" className="block text-sm font-medium text-gray-700 mb-1">
                Número de contacto secundario
              </label>
              <input
                id="edit_telefono_secundario"
                name="telefono_secundario"
                type="tel"
                value={form.telefono_secundario}
                onChange={handleChange}
                className={fieldClass}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-stone-900 border-b pb-2">Datos del animal</h3>
            <div>
              <label htmlFor="edit_nombre_mascota" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                id="edit_nombre_mascota"
                name="nombre_mascota"
                type="text"
                required
                value={form.nombre_mascota}
                onChange={handleChange}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="edit_foto_url" className="block text-sm font-medium text-gray-700 mb-1">
                URL de foto
              </label>
              <input
                id="edit_foto_url"
                name="foto_url"
                type="url"
                value={form.foto_url}
                onChange={handleChange}
                className={fieldClass}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="edit_especie" className="block text-sm font-medium text-gray-700 mb-1">
                  Especie *
                </label>
                <select
                  id="edit_especie"
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
                <label htmlFor="edit_raza" className="block text-sm font-medium text-gray-700 mb-1">
                  Raza
                </label>
                <input
                  id="edit_raza"
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
                <label htmlFor="edit_sexo" className="block text-sm font-medium text-gray-700 mb-1">
                  Sexo *
                </label>
                <select
                  id="edit_sexo"
                  name="sexo"
                  value={form.sexo}
                  onChange={handleChange}
                  className={fieldClass}
                >
                  {SEXOS.map((sexo) => (
                    <option key={sexo} value={sexo}>
                      {sexo}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="edit_castrado" className="block text-sm font-medium text-gray-700 mb-1">
                  Castrado *
                </label>
                <select
                  id="edit_castrado"
                  name="castrado"
                  value={form.castrado}
                  onChange={handleChange}
                  className={fieldClass}
                >
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="edit_nro_chip" className="block text-sm font-medium text-gray-700 mb-1">
                N° de chip
              </label>
              <input
                id="edit_nro_chip"
                name="nro_chip"
                type="text"
                value={form.nro_chip}
                onChange={handleChange}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="edit_enfermedad" className="block text-sm font-medium text-gray-700 mb-1">
                ¿Posee alguna enfermedad? ¿Cuál?
              </label>
              <textarea
                id="edit_enfermedad"
                name="enfermedad"
                rows={2}
                value={form.enfermedad}
                onChange={handleChange}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="edit_medicacion" className="block text-sm font-medium text-gray-700 mb-1">
                ¿Toma alguna medicación?
              </label>
              <textarea
                id="edit_medicacion"
                name="medicacion"
                rows={2}
                value={form.medicacion}
                onChange={handleChange}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="edit_datos_adicionales" className="block text-sm font-medium text-gray-700 mb-1">
                Datos adicionales
              </label>
              <textarea
                id="edit_datos_adicionales"
                name="datos_adicionales"
                rows={3}
                value={form.datos_adicionales}
                onChange={handleChange}
                className={fieldClass}
              />
            </div>
          </section>

          {error && (
            <p className="text-red-600 text-sm" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {submitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminEditMascotaModal;
