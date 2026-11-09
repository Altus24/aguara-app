'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/chapitas/supabaseClient';
import {
  getChapitaAppPath,
  isDynamicChapitaId,
  parseChapitaTirada,
  CHAPITAS_PER_TIRADA,
  countActivatedInTirada,
  countAvailableInTirada,
  countAvailableAllTiradas,
  countActivatedAllTiradas,
  formatChapitaIdLabel,
  getTiradaIdRange,
  normalizeChapitaId,
  MAX_TIRADAS,
} from '@/lib/chapitas/chapitaId';
import {
  downloadChapitaQrSvg,
  downloadTiradaQrZip,
  generateChapitaQrSvg,
} from '@/lib/chapitas/chapitaQr';
import { useAuth } from '@/context/AuthContext';
import AdminEditMascotaModal from './AdminEditMascotaModal';

function isOrphanWebChapita(chapitaId) {
  return isDynamicChapitaId(String(chapitaId).trim().toLowerCase());
}

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [mascotas, setMascotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editingMascota, setEditingMascota] = useState(null);
  const [tiradaActual, setTiradaActual] = useState(1);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [zipProgress, setZipProgress] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [mascotasRes, chapitasRes, inventarioRes] = await Promise.all([
      supabase.from('mascotas').select('*').order('creado_en', { ascending: false }),
      supabase.from('chapitas').select('id'),
      supabase
        .from('chapita_inventario')
        .select('tirada_actual, max_id_numerico')
        .eq('id', 1)
        .maybeSingle(),
    ]);

    if (mascotasRes.error || chapitasRes.error) {
      setMessage('Error al cargar datos.');
    } else {
      const mascotasData = mascotasRes.data || [];
      const activatedIds = new Set(mascotasData.map((m) => m.id));
      const orphanWebIds = (chapitasRes.data || [])
        .filter((c) => isOrphanWebChapita(c.id) && !activatedIds.has(c.id))
        .map((c) => c.id);

      if (orphanWebIds.length > 0) {
        await supabase.from('chapitas').delete().in('id', orphanWebIds);
      }

      setMascotas(mascotasData);
      if (inventarioRes.data?.tirada_actual) {
        setTiradaActual(inventarioRes.data.tirada_actual);
      } else if (inventarioRes.data?.max_id_numerico) {
        setTiradaActual(
          Math.max(1, Math.floor(inventarioRes.data.max_id_numerico / CHAPITAS_PER_TIRADA))
        );
      }
      setMessage('');
    }
    setLoading(false);
  }, []);

  const handleMascotaSaved = (updatedMascota) => {
    setMascotas((prev) =>
      prev.map((item) => (item.id === updatedMascota.id ? updatedMascota : item))
    );
    setSuccessMessage(`Ficha ${formatChapitaIdLabel(updatedMascota.id)} actualizada correctamente.`);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sinActivarTotal = countAvailableAllTiradas(mascotas, tiradaActual);
  const activadasTotal = countActivatedAllTiradas(mascotas, tiradaActual);
  const stockTotal = tiradaActual * CHAPITAS_PER_TIRADA;

  const mascotasActivadas = mascotas.filter((m) => {
    const parsed = parseChapitaTirada(m.id);
    return parsed && !parsed.web;
  });

  const tiradaStats = useMemo(() => {
    return Array.from({ length: tiradaActual }, (_, index) => {
      const tirada = index + 1;
      const activadas = countActivatedInTirada(mascotas, tirada);
      const disponibles = countAvailableInTirada(mascotas, tirada);
      const range = getTiradaIdRange(tirada);
      return { tirada, activadas, disponibles, ...range };
    });
  }, [mascotas, tiradaActual]);

  const nextTirada = tiradaActual + 1;
  const nextRange = getTiradaIdRange(nextTirada);
  const canCreateBatch = tiradaActual < MAX_TIRADAS;

  const handleDeleteMascota = async (id) => {
    if (!window.confirm(`¿Eliminar la ficha de la chapita ${formatChapitaIdLabel(id)}?`)) return;
    const { error } = await supabase.from('mascotas').delete().eq('id', id);
    if (error) {
      setMessage('No se pudo eliminar la mascota.');
      return;
    }
    await loadData();
  };

  const handleDownloadQr = async (mascota) => {
    try {
      const svg = mascota.qr_svg || (await generateChapitaQrSvg(mascota.id));
      downloadChapitaQrSvg(mascota.id, svg);
    } catch {
      setMessage('No se pudo descargar el QR.');
    }
  };

  const handleDownloadTiradaZip = async (tirada) => {
    setMessage('');
    setSuccessMessage('');
    setZipProgress({ done: 0, total: CHAPITAS_PER_TIRADA, tirada });
    try {
      await downloadTiradaQrZip(tirada, (done, total) => {
        setZipProgress({ done, total, tirada });
      });
      const range = getTiradaIdRange(tirada);
      setSuccessMessage(
        `ZIP listo: chapitas ${range.desde}–${range.hasta} (${CHAPITAS_PER_TIRADA} QR).`
      );
    } catch {
      setMessage('No se pudo crear el ZIP de QR. Intentá nuevamente.');
    } finally {
      setZipProgress(null);
    }
  };

  const handleCreateBatch = async () => {
    if (!canCreateBatch) return;
    const confirmed = window.confirm(
      `¿Crear tirada ${nextTirada} con 100 chapitas (${nextRange.desde}–${nextRange.hasta}) y descargar el ZIP?`
    );
    if (!confirmed) return;

    setCreatingBatch(true);
    setMessage('');
    setSuccessMessage('');
    const { data, error } = await supabase.rpc('crear_lote_100_chapitas');
    setCreatingBatch(false);

    if (error) {
      setMessage(
        error.message?.includes('not authorized')
          ? 'Sin permisos para crear lotes.'
          : 'No se pudo crear la tirada. Ejecutá supabase/migration_chapita_numeros.sql en Supabase.'
      );
      return;
    }

    const tirada = data.tirada;
    setSuccessMessage(`Tirada ${tirada} creada (${data.desde}–${data.hasta}). Generando ZIP…`);
    await loadData();
    await handleDownloadTiradaZip(tirada);
  };

  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-blue-800">Panel superadmin</h1>
        <button type="button" onClick={signOut} className="text-gray-600 underline">
          Salir
        </button>
      </div>

      {message && <p className="mb-4 text-red-600">{message}</p>}
      {successMessage && <p className="mb-4 text-green-700">{successMessage}</p>}
      {loading && <p className="text-gray-600">Cargando...</p>}

      <AdminEditMascotaModal
        mascota={editingMascota}
        onClose={() => setEditingMascota(null)}
        onSaved={handleMascotaSaved}
      />

      {!loading && (
        <>
          <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
            <h2 className="text-xl font-semibold text-blue-700 mb-3">Inventario de chapitas</h2>
            <p className="mb-4 text-sm text-gray-600">
              Tirada 1: T1-001–T1-100. Tirada 2: 200–299. Tirada 3: 300–399. Al crear una tirada
              nueva, suman 100 chapitas sin activar.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm mb-4">
              <div className="rounded-md bg-blue-50 p-4">
                <p className="text-gray-600">Sin activar</p>
                <p className="text-3xl font-bold text-blue-800">{sinActivarTotal}</p>
                <p className="text-xs text-gray-500 mt-1">
                  de {stockTotal} ({tiradaActual} tirada{tiradaActual === 1 ? '' : 's'})
                </p>
              </div>
              <div className="rounded-md bg-green-50 p-4">
                <p className="text-gray-600">Activadas</p>
                <p className="text-3xl font-bold text-green-800">{activadasTotal}</p>
              </div>
              <div className="rounded-md bg-blue-50 p-4 flex flex-col justify-center">
                <button
                  type="button"
                  disabled={!canCreateBatch || creatingBatch || Boolean(zipProgress)}
                  onClick={handleCreateBatch}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingBatch || zipProgress
                    ? zipProgress
                      ? `Generando ZIP… ${zipProgress.done}/${zipProgress.total}`
                      : 'Creando tirada...'
                    : `Crear tirada ${nextTirada} (${nextRange.desde}–${nextRange.hasta})`}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Crea el lote en el sistema y descarga el ZIP con logo.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-blue-50 text-left">
                  <tr>
                    <th className="p-2">Tirada</th>
                    <th className="p-2">Sin activar</th>
                    <th className="p-2">Activadas</th>
                    <th className="p-2">Rango ID</th>
                    <th className="p-2">QR</th>
                  </tr>
                </thead>
                <tbody>
                  {tiradaStats.map((row) => (
                    <tr key={row.tirada} className="border-t">
                      <td className="p-2 font-semibold">T{row.tirada}</td>
                      <td className="p-2">
                        {row.disponibles} / {CHAPITAS_PER_TIRADA}
                      </td>
                      <td className="p-2">{row.activadas}</td>
                      <td className="p-2 font-mono text-xs">
                        {row.desde}–{row.hasta}
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          disabled={Boolean(zipProgress)}
                          onClick={() => handleDownloadTiradaZip(row.tirada)}
                          className="text-blue-600 underline disabled:opacity-50"
                        >
                          {zipProgress?.tirada === row.tirada
                            ? `${zipProgress.done}/${zipProgress.total}`
                            : 'Descargar ZIP'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 rounded-md border border-blue-100 bg-blue-50/60 p-4">
              <label htmlFor="buscar-chapita" className="block text-sm font-medium text-gray-700 mb-2">
                Buscar chapita
              </label>
              <input
                id="buscar-chapita"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="ID (T1-001, 200…), mascota o responsable"
                className="w-full max-w-md rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery.trim() && (
                <div className="mt-3 space-y-2 text-sm">
                  {(() => {
                    const q = searchQuery.trim().toLowerCase();
                    const normalized = normalizeChapitaId(searchQuery.trim());
                    const matches = mascotasActivadas.filter((m) => {
                      const idLabel = formatChapitaIdLabel(m.id).toLowerCase();
                      return (
                        m.id.toLowerCase().includes(q) ||
                        idLabel.includes(q) ||
                        (normalized && m.id === normalized) ||
                        m.nombre_mascota?.toLowerCase().includes(q) ||
                        m.nombre_dueno?.toLowerCase().includes(q) ||
                        m.email_tutor?.toLowerCase().includes(q) ||
                        m.telefono_contacto?.includes(searchQuery.trim()) ||
                        m.telefono_secundario?.includes(searchQuery.trim())
                      );
                    });

                    if (matches.length > 0) {
                      return matches.slice(0, 8).map((m) => {
                        const parsed = parseChapitaTirada(m.id);
                        return (
                          <div
                            key={m.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 shadow-sm"
                          >
                            <div>
                              <p className="font-mono font-semibold text-blue-800">
                                {formatChapitaIdLabel(m.id)}
                                <span className="ml-2 text-xs font-normal text-green-700">
                                  Activada
                                </span>
                              </p>
                              <p className="text-gray-600">
                                {m.nombre_mascota} · {m.nombre_dueno}
                                {parsed && !parsed.web ? ` · T${parsed.tirada}` : ''}
                              </p>
                            </div>
                            <div className="flex gap-3">
                              <Link
                                href={getChapitaAppPath(m.id)}
                                className="text-blue-600 underline"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Ver
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  setSuccessMessage('');
                                  setEditingMascota(m);
                                }}
                                className="text-blue-600 underline"
                              >
                                Editar
                              </button>
                            </div>
                          </div>
                        );
                      });
                    }

                    if (normalized) {
                      const parsed = parseChapitaTirada(normalized);
                      if (parsed && !parsed.web && parsed.tirada <= tiradaActual) {
                        return (
                          <div className="rounded-md bg-white px-3 py-2 shadow-sm">
                            <p className="font-mono font-semibold text-blue-800">
                              {formatChapitaIdLabel(normalized)}
                              <span className="ml-2 text-xs font-normal text-amber-700">
                                Sin activar
                              </span>
                            </p>
                            <p className="text-gray-600">
                              Tirada T{parsed.tirada}. Todavía no completaron el formulario.
                            </p>
                            <Link
                              href={getChapitaAppPath(normalized)}
                              className="mt-1 inline-block text-blue-600 underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Abrir formulario
                            </Link>
                          </div>
                        );
                      }
                    }

                    return (
                      <p className="text-gray-500">
                        No se encontró ninguna chapita con “{searchQuery.trim()}”.
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-xl font-semibold text-blue-700 mb-4">
              Chapitas activadas ({mascotasActivadas.length})
            </h2>
            <div className="overflow-x-auto rounded-lg bg-white shadow-md">
              <table className="min-w-full text-sm">
                <thead className="bg-blue-50 text-left">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Tirada</th>
                    <th className="p-3">Mascota</th>
                    <th className="p-3">Responsable</th>
                    <th className="p-3">Teléfono</th>
                    <th className="p-3">Activada</th>
                    <th className="p-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {mascotasActivadas.map((m) => {
                    const parsed = parseChapitaTirada(m.id);
                    const tiradaLabel = parsed && !parsed.web ? `T${parsed.tirada}` : 'Web';
                    return (
                      <tr key={m.id} className="border-t">
                        <td className="p-3 font-mono">{formatChapitaIdLabel(m.id)}</td>
                        <td className="p-3">{tiradaLabel}</td>
                        <td className="p-3">{m.nombre_mascota}</td>
                        <td className="p-3">{m.nombre_dueno}</td>
                        <td className="p-3">{m.telefono_contacto}</td>
                        <td className="p-3 whitespace-nowrap">
                          {m.creado_en
                            ? new Date(m.creado_en).toLocaleString('es-AR')
                            : '—'}
                        </td>
                        <td className="p-3 space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDownloadQr(m)}
                            className="text-blue-600 underline"
                          >
                            QR SVG
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSuccessMessage('');
                              setEditingMascota(m);
                            }}
                            className="text-blue-600 underline"
                          >
                            Editar
                          </button>
                          <Link
                            href={getChapitaAppPath(m.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            Ver
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDeleteMascota(m.id)}
                            className="text-red-600 underline"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {mascotasActivadas.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-gray-500">
                        Todavía no se activó ninguna chapita.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
