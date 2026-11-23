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
  formatTiradaChapitaId,
  getTiradaIdRange,
  normalizeChapitaId,
  MAX_TIRADAS,
} from '@/lib/chapitas/chapitaId';
import {
  downloadChapitaQrSvg,
  downloadTiradaQrPack,
  downloadTiradaQrPdf,
  downloadTiradaQrZip,
  generateChapitaQrSvg,
  getA4QrGrid,
} from '@/lib/chapitas/chapitaQr';
import { loadQrEstilo, loadQrPlantillas, normalizeQrEstilo } from '@/lib/chapitas/qrEstilo';
import { formatDateTime } from '@/lib/dateFormat';
import {
  CANTIDAD_SIN_CONFIG,
  DEFAULT_TIRADA_CANTIDAD,
  TIRADA_CANTIDAD_OPTIONS,
  clearAllTiradaConfigs,
  deleteTiradaConfig,
  getTiradaConfig,
  loadAllTiradaConfigs,
  plantillaLabel,
  resolveTiradaEstilo,
  setTiradaConfig,
} from '@/lib/chapitas/tiradaConfig';
import { confirmAccion, confirmEliminar, confirmGuardar } from '@/lib/confirmAction';
import { useAuth } from '@/context/AuthContext';
import {
  actualizarClinica,
  crearClinica,
  eliminarClinica,
} from '@/lib/chapitas/clinicas';
import {
  ciudadesDeProvincia,
  provinciaPorDefecto,
  provinciasDisponibles,
} from '@/lib/chapitas/ubicacionesAr';
import AdminEditMascotaModal from './AdminEditMascotaModal';
import QrEstiloSection from './QrEstiloSection';

function isOrphanWebChapita(chapitaId) {
  return isDynamicChapitaId(String(chapitaId).trim().toLowerCase());
}

const EMPTY_CLINICA_FORM = {
  nombre: '',
  email: '',
  telefono: '',
  direccion: '',
  ciudad: '',
  provincia: provinciaPorDefecto(),
  descripcion: '',
};

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [mascotas, setMascotas] = useState([]);
  const [clinicas, setClinicas] = useState([]);
  const [tutores, setTutores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editingMascota, setEditingMascota] = useState(null);
  const [tiradaActual, setTiradaActual] = useState(1);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [zipProgress, setZipProgress] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState('chapitas');
  const [registryQuery, setRegistryQuery] = useState('');
  const [clinicaForm, setClinicaForm] = useState(EMPTY_CLINICA_FORM);
  const [editingClinicaId, setEditingClinicaId] = useState(null);
  const [showClinicaForm, setShowClinicaForm] = useState(false);
  const [savingClinica, setSavingClinica] = useState(false);
  const [qrEstilo, setQrEstilo] = useState(() => loadQrEstilo());
  const [qrPlantillas, setQrPlantillas] = useState([]);
  const [tiradaConfigs, setTiradaConfigs] = useState({});
  const [nuevaTiradaCantidad, setNuevaTiradaCantidad] = useState(DEFAULT_TIRADA_CANTIDAD);
  const [nuevaTiradaPlantillaId, setNuevaTiradaPlantillaId] = useState('');

  useEffect(() => {
    setQrPlantillas(loadQrPlantillas());
    setTiradaConfigs(loadAllTiradaConfigs());
  }, [tab]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [mascotasRes, chapitasRes, inventarioRes, clinicasRes, tutoresRes] = await Promise.all([
      supabase.from('mascotas').select('*').order('creado_en', { ascending: false }),
      supabase.from('chapitas').select('id'),
      supabase
        .from('chapita_inventario')
        .select('tirada_actual, max_id_numerico')
        .eq('id', 1)
        .maybeSingle(),
      supabase
        .from('clinicas')
        .select('id, nombre, email, telefono, direccion, ciudad, provincia, creado_en')
        .order('creado_en', { ascending: false }),
      supabase
        .from('tutores')
        .select('id, nombre_completo, email, telefono, telefono_secundario, creado_en')
        .order('creado_en', { ascending: false }),
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
      if (inventarioRes.data && inventarioRes.data.tirada_actual != null) {
        setTiradaActual(Number(inventarioRes.data.tirada_actual) || 0);
      } else if (inventarioRes.data?.max_id_numerico) {
        setTiradaActual(
          Math.max(0, Math.floor(inventarioRes.data.max_id_numerico / CHAPITAS_PER_TIRADA))
        );
      } else {
        setTiradaActual(0);
      }
      setMessage('');
    }

    if (clinicasRes.error) {
      setClinicas([]);
    } else {
      setClinicas(clinicasRes.data || []);
    }

    if (tutoresRes.error) {
      setTutores([]);
    } else {
      setTutores(tutoresRes.data || []);
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

  const tiradaConfigsResolved = useMemo(() => {
    const map = {};
    for (let t = 1; t <= tiradaActual; t += 1) {
      map[t] = tiradaConfigs[String(t)] || getTiradaConfig(t);
    }
    return map;
  }, [tiradaActual, tiradaConfigs]);

  const cantidadesByTirada = useMemo(() => {
    const map = {};
    for (let t = 1; t <= tiradaActual; t += 1) {
      const cfg = tiradaConfigsResolved[t];
      map[t] = cfg?.cantidad ?? CANTIDAD_SIN_CONFIG;
    }
    return map;
  }, [tiradaActual, tiradaConfigsResolved]);

  const sinActivarTotal = countAvailableAllTiradas(mascotas, tiradaActual, cantidadesByTirada);
  const activadasTotal = countActivatedAllTiradas(mascotas, tiradaActual, cantidadesByTirada);
  const stockTotal = Object.values(cantidadesByTirada).reduce(
    (sum, n) => sum + (Number(n) || CANTIDAD_SIN_CONFIG),
    0
  );

  const mascotasActivadas = mascotas.filter((m) => {
    const parsed = parseChapitaTirada(m.id);
    return parsed && !parsed.web;
  });

  const tiradaStats = useMemo(() => {
    return Array.from({ length: tiradaActual }, (_, index) => {
      const tirada = index + 1;
      const cfg = tiradaConfigsResolved[tirada] || getTiradaConfig(tirada);
      const cantidad = cfg.cantidad;
      const activadas = countActivatedInTirada(mascotas, tirada, cantidad);
      const disponibles = countAvailableInTirada(mascotas, tirada, cantidad);
      const range = getTiradaIdRange(tirada);
      return {
        tirada,
        cantidad,
        definida: Boolean(cfg.definida),
        plantilla_id: cfg.plantilla_id,
        activadas,
        disponibles,
        desde: formatTiradaChapitaId(tirada, 1),
        hasta: formatTiradaChapitaId(tirada, cantidad),
        bloqueHasta: range.hasta,
      };
    });
  }, [mascotas, tiradaActual, tiradaConfigsResolved]);

  const nextTirada = tiradaActual + 1;
  const canCreateBatch = tiradaActual < MAX_TIRADAS;

  const mascotasPorTutor = useMemo(() => {
    const counts = new Map();
    for (const m of mascotas) {
      if (!m.tutor_id) continue;
      counts.set(m.tutor_id, (counts.get(m.tutor_id) || 0) + 1);
    }
    return counts;
  }, [mascotas]);

  const registryQ = registryQuery.trim().toLowerCase();
  const clinicasFiltradas = useMemo(() => {
    if (!registryQ) return clinicas;
    return clinicas.filter(
      (c) =>
        c.nombre?.toLowerCase().includes(registryQ) ||
        c.email?.toLowerCase().includes(registryQ) ||
        c.telefono?.includes(registryQuery.trim()) ||
        c.ciudad?.toLowerCase().includes(registryQ),
    );
  }, [clinicas, registryQ, registryQuery]);

  const tutoresFiltrados = useMemo(() => {
    if (!registryQ) return tutores;
    return tutores.filter(
      (t) =>
        t.nombre_completo?.toLowerCase().includes(registryQ) ||
        t.email?.toLowerCase().includes(registryQ) ||
        t.telefono?.includes(registryQuery.trim()),
    );
  }, [tutores, registryQ, registryQuery]);

  const TABS = [
    { id: 'chapitas', label: 'Chapitas' },
    { id: 'qr', label: 'Personalizar QR' },
    { id: 'clinicas', label: `Clínicas (${clinicas.length})` },
    { id: 'tutores', label: `Tutores (${tutores.length})` },
  ];

  function openNuevaClinica() {
    setEditingClinicaId(null);
    setClinicaForm(EMPTY_CLINICA_FORM);
    setShowClinicaForm(true);
    setMessage('');
    setSuccessMessage('');
  }

  function openEditarClinica(clinica) {
    setEditingClinicaId(clinica.id);
    setClinicaForm({
      nombre: clinica.nombre || '',
      email: clinica.email || '',
      telefono: clinica.telefono || '',
      direccion: clinica.direccion || '',
      ciudad: clinica.ciudad || '',
      provincia: clinica.provincia || provinciaPorDefecto(),
      descripcion: clinica.descripcion || '',
    });
    setShowClinicaForm(true);
    setMessage('');
    setSuccessMessage('');
  }

  async function handleSaveClinica(event) {
    event.preventDefault();
    const detalle = editingClinicaId ? 'los cambios de la clínica' : 'la nueva clínica';
    if (!(await confirmGuardar(detalle))) return;
    setSavingClinica(true);
    setMessage('');
    setSuccessMessage('');
    try {
      if (editingClinicaId) {
        const updated = await actualizarClinica(editingClinicaId, {
          nombre: clinicaForm.nombre,
          email: clinicaForm.email,
          telefono: clinicaForm.telefono,
          direccion: clinicaForm.direccion,
          ciudad: clinicaForm.ciudad,
          provincia: clinicaForm.provincia,
          descripcion: clinicaForm.descripcion || null,
        });
        setClinicas((prev) =>
          prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
        );
        setSuccessMessage(`Clínica “${updated.nombre}” actualizada.`);
      } else {
        const created = await crearClinica(clinicaForm);
        setClinicas((prev) => [created, ...prev]);
        setSuccessMessage(`Clínica “${created.nombre}” creada.`);
      }
      setShowClinicaForm(false);
      setEditingClinicaId(null);
      setClinicaForm(EMPTY_CLINICA_FORM);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo guardar la clínica.');
    } finally {
      setSavingClinica(false);
    }
  }

  async function handleDeleteClinica(clinica) {
    if (
      !(await confirmEliminar(
        `la clínica “${clinica.nombre}” (y sus datos operativos vinculados)`,
      ))
    ) {
      return;
    }
    setMessage('');
    setSuccessMessage('');
    try {
      await eliminarClinica(clinica.id);
      setClinicas((prev) => prev.filter((item) => item.id !== clinica.id));
      if (editingClinicaId === clinica.id) {
        setShowClinicaForm(false);
        setEditingClinicaId(null);
      }
      setSuccessMessage(`Clínica “${clinica.nombre}” eliminada.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo eliminar la clínica.');
    }
  }


  const handleDeleteMascota = async (id) => {
    if (!(await confirmEliminar(`la ficha de la chapita ${formatChapitaIdLabel(id)}`))) return;
    const { error } = await supabase.from('mascotas').delete().eq('id', id);
    if (error) {
      setMessage('No se pudo eliminar la mascota.');
      return;
    }
    await loadData();
  };

  const handleDownloadQr = async (mascota) => {
    try {
      const svg = await generateChapitaQrSvg(mascota.id, qrEstilo);
      downloadChapitaQrSvg(mascota.id, svg);
    } catch {
      setMessage('No se pudo descargar el QR.');
    }
  };

  function refreshPlantillas() {
    setQrPlantillas(loadQrPlantillas());
  }

  function updateTiradaConfigLocal(tirada, patch) {
    const next = setTiradaConfig(tirada, patch);
    setTiradaConfigs((prev) => ({ ...prev, [String(tirada)]: next }));
    return next;
  }

  function estiloForTirada(tirada) {
    return resolveTiradaEstilo(tirada, qrEstilo);
  }

  const handleDownloadTiradaZipOnly = async (tirada) => {
    const config = getTiradaConfig(tirada);
    const estilo = estiloForTirada(tirada);
    const cantidad = config.cantidad || CHAPITAS_PER_TIRADA;
    setMessage('');
    setSuccessMessage('');
    setZipProgress({ done: 0, total: cantidad, tirada, phase: 'zip' });
    try {
      await downloadTiradaQrZip(
        tirada,
        (done, total) => {
          setZipProgress({ done, total, tirada, phase: 'zip' });
        },
        estilo,
        { cantidad },
      );
      const desde = formatTiradaChapitaId(tirada, 1);
      const hasta = formatTiradaChapitaId(tirada, cantidad);
      setSuccessMessage(`ZIP listo: ${desde}–${hasta} (${cantidad} QR).`);
    } catch {
      setMessage('No se pudo crear el ZIP de QR. Intentá nuevamente.');
    } finally {
      setZipProgress(null);
    }
  };

  const handleDownloadTiradaPdfOnly = async (tirada) => {
    const config = getTiradaConfig(tirada);
    const estilo = estiloForTirada(tirada);
    const cantidad = config.cantidad || CHAPITAS_PER_TIRADA;
    const grid = getA4QrGrid({
      anchoCm: estilo.tamano_ancho_cm,
      altoCm: estilo.tamano_alto_cm,
    });
    setMessage('');
    setSuccessMessage('');
    setZipProgress({ done: 0, total: cantidad, tirada, phase: 'pdf' });
    try {
      const result = await downloadTiradaQrPdf(
        tirada,
        (done, total, phase) => {
          setZipProgress({ done, total, tirada, phase: phase || 'pdf' });
        },
        estilo,
        { cantidad },
      );
      const desde = formatTiradaChapitaId(tirada, 1);
      const hasta = formatTiradaChapitaId(tirada, cantidad);
      setSuccessMessage(
        `PDF A4 listo: ${desde}–${hasta} (${cantidad} QR, ${result.pages} hoja${
          result.pages === 1 ? '' : 's'
        }, ${result.perPage || grid.perPage} QR/hoja).`,
      );
    } catch {
      setMessage('No se pudo crear el PDF de QR. Intentá nuevamente.');
    } finally {
      setZipProgress(null);
    }
  };

  const handleDownloadTiradaZip = async (tirada) => {
    const config = getTiradaConfig(tirada);
    const estilo = estiloForTirada(tirada);
    const cantidad = config.cantidad || CHAPITAS_PER_TIRADA;
    const grid = getA4QrGrid({
      anchoCm: estilo.tamano_ancho_cm,
      altoCm: estilo.tamano_alto_cm,
    });
    const hojasEstimadas = Math.max(1, Math.ceil(cantidad / grid.perPage));
    setMessage('');
    setSuccessMessage('');
    setZipProgress({ done: 0, total: cantidad, tirada, phase: 'generar' });
    try {
      const result = await downloadTiradaQrPack(
        tirada,
        (done, total, phase) => {
          setZipProgress({ done, total, tirada, phase: phase || 'generar' });
        },
        estilo,
        { cantidad }
      );
      const desde = formatTiradaChapitaId(tirada, 1);
      const hasta = formatTiradaChapitaId(tirada, cantidad);
      const plantilla = qrPlantillas.find((p) => p.id === config.plantilla_id);
      setSuccessMessage(
        `Descarga lista: ZIP + PDF A4 (${result.pages || hojasEstimadas} hoja${
          (result.pages || hojasEstimadas) === 1 ? '' : 's'
        }, ${result.perPage || grid.perPage} QR/hoja) · ${desde}–${hasta} (${cantidad} QR)` +
          `${plantilla ? ` · plantilla “${plantilla.nombre}”` : ' · estilo activo'}.`
      );
    } catch {
      setMessage('No se pudo crear el ZIP/PDF de QR. Intentá nuevamente.');
    } finally {
      setZipProgress(null);
    }
  };

  const handleEliminarTirada = async (tirada) => {
    if (tirada !== tiradaActual) {
      setMessage('Solo se puede eliminar la última tirada (la más reciente).');
      return;
    }
    if (
      !(await confirmEliminar(
        tirada === 1
          ? 'la tirada T1 y dejar el inventario vacío para empezar de nuevo'
          : `la tirada T${tirada} y todas sus fichas activadas en ese lote`,
      ))
    ) {
      return;
    }
    setMessage('');
    setSuccessMessage('');
    const { data, error } = await supabase.rpc('eliminar_ultima_tirada');
    if (error) {
      setMessage(
        error.message?.includes('not authorized')
          ? 'Sin permisos para eliminar tiradas.'
          : error.message?.includes('eliminar_ultima_tirada') ||
              error.message?.includes('Could not find')
            ? 'No se pudo eliminar. Ejecutá supabase/chapitas/25_eliminar_tirada_vacia.sql en Supabase.'
            : 'No se pudo eliminar la tirada.',
      );
      return;
    }
    if (data?.reinicio || Number(data?.tirada_actual) === 0) {
      clearAllTiradaConfigs();
      setTiradaConfigs({});
    } else {
      deleteTiradaConfig(tirada);
      setTiradaConfigs(loadAllTiradaConfigs());
    }
    setSuccessMessage(
      data?.reinicio || Number(data?.tirada_actual) === 0
        ? 'Inventario vacío. Ya podés crear T1 con la config nueva.'
        : `Tirada T${data?.tirada_eliminada || tirada} eliminada.`,
    );
    await loadData();
  };

  const handleReiniciarInventario = async () => {
    if (
      !(await confirmAccion(
        '¿Vaciar TODO el inventario de chapitas (todas las tiradas y fichas activadas)? Vas a poder crear T1 de nuevo desde cero.',
      ))
    ) {
      return;
    }
    setMessage('');
    setSuccessMessage('');
    const { error } = await supabase.rpc('reset_todas_las_tiradas');
    if (error) {
      setMessage(
        error.message?.includes('not authorized')
          ? 'Sin permisos para reiniciar el inventario.'
          : 'No se pudo reiniciar. Ejecutá supabase/chapitas/25_eliminar_tirada_vacia.sql en Supabase.',
      );
      return;
    }
    clearAllTiradaConfigs();
    setTiradaConfigs({});
    setSuccessMessage('Inventario reiniciado. Creá una tirada nueva cuando quieras.');
    await loadData();
  };

  const handleCreateBatch = async () => {
    if (!canCreateBatch) return;
    const cantidad = Number(nuevaTiradaCantidad) || CHAPITAS_PER_TIRADA;
    const plantilla = qrPlantillas.find((p) => p.id === nuevaTiradaPlantillaId);
    if (
      !(await confirmAccion(
        `¿Crear tirada ${nextTirada} y descargar ${cantidad} QR (${formatTiradaChapitaId(nextTirada, 1)}–${formatTiradaChapitaId(nextTirada, cantidad)})` +
          `${plantilla ? ` con plantilla “${plantilla.nombre}”` : ' con el estilo activo'}?\n\n` +
          `Nota: el inventario reserva el bloque completo de ${CHAPITAS_PER_TIRADA} IDs; el ZIP incluye solo la cantidad elegida.`,
      ))
    ) {
      return;
    }

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
    updateTiradaConfigLocal(tirada, {
      cantidad,
      plantilla_id: nuevaTiradaPlantillaId || null,
    });
    setSuccessMessage(
      `Tirada ${tirada} creada. Generando ZIP + PDF A4 de ${cantidad} QR…`
    );
    await loadData();
    await handleDownloadTiradaZip(tirada);
  };

  return (
    <section
      className={`mx-auto px-4 py-10 ${tab === 'qr' ? 'max-w-[95vw]' : 'max-w-5xl'}`}
    >
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
          <div className="mb-6 flex flex-wrap gap-2">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setRegistryQuery('');
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  tab === item.id
                    ? 'bg-blue-700 text-white'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'qr' ? (
            <QrEstiloSection
              onSaved={(estilo) => {
                setQrEstilo(normalizeQrEstilo(estilo));
                refreshPlantillas();
              }}
            />
          ) : null}

          {tab === 'clinicas' ? (
            <div className="mb-10 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-blue-700">Clínicas registradas</h2>
                  <p className="text-sm text-gray-600">
                    {clinicas.length} clínica{clinicas.length === 1 ? '' : 's'} en total
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <input
                    type="search"
                    value={registryQuery}
                    onChange={(e) => setRegistryQuery(e.target.value)}
                    placeholder="Buscar por nombre, email, ciudad…"
                    className="w-full max-w-md rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={openNuevaClinica}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Nueva clínica
                  </button>
                </div>
              </div>

              {showClinicaForm ? (
                <form
                  onSubmit={handleSaveClinica}
                  className="space-y-3 rounded-lg bg-white p-5 shadow-md"
                >
                  <h3 className="font-semibold text-blue-800">
                    {editingClinicaId ? 'Editar clínica' : 'Agregar clínica'}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-gray-700">Nombre</span>
                      <input
                        required
                        minLength={2}
                        value={clinicaForm.nombre}
                        onChange={(e) =>
                          setClinicaForm((f) => ({ ...f, nombre: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-gray-700">Email</span>
                      <input
                        required
                        type="email"
                        value={clinicaForm.email}
                        onChange={(e) =>
                          setClinicaForm((f) => ({ ...f, email: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-gray-700">Teléfono</span>
                      <input
                        required
                        minLength={6}
                        value={clinicaForm.telefono}
                        onChange={(e) =>
                          setClinicaForm((f) => ({ ...f, telefono: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-gray-700">Dirección</span>
                      <input
                        required
                        value={clinicaForm.direccion}
                        onChange={(e) =>
                          setClinicaForm((f) => ({ ...f, direccion: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-gray-700">Provincia</span>
                      <select
                        required
                        value={clinicaForm.provincia}
                        onChange={(e) => {
                          const provincia = e.target.value;
                          const nextCiudades = ciudadesDeProvincia(provincia);
                          setClinicaForm((f) => ({
                            ...f,
                            provincia,
                            ciudad: nextCiudades.includes(f.ciudad) ? f.ciudad : '',
                          }));
                        }}
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                      >
                        {provinciasDisponibles().map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-gray-700">
                        Ciudad / departamento
                      </span>
                      <select
                        required
                        value={clinicaForm.ciudad}
                        onChange={(e) =>
                          setClinicaForm((f) => ({ ...f, ciudad: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                      >
                        <option value="">Seleccioná…</option>
                        {ciudadesDeProvincia(clinicaForm.provincia).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        {clinicaForm.ciudad &&
                        !ciudadesDeProvincia(clinicaForm.provincia).includes(
                          clinicaForm.ciudad,
                        ) ? (
                          <option value={clinicaForm.ciudad}>
                            {clinicaForm.ciudad} (actual)
                          </option>
                        ) : null}
                      </select>
                    </label>
                    <label className="block text-sm sm:col-span-2">
                      <span className="mb-1 block font-medium text-gray-700">
                        Descripción (opcional)
                      </span>
                      <textarea
                        rows={2}
                        value={clinicaForm.descripcion}
                        onChange={(e) =>
                          setClinicaForm((f) => ({ ...f, descripcion: e.target.value }))
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Por ahora la contraseña de ingreso de la clínica es el mismo email.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={savingClinica}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {savingClinica
                        ? 'Guardando…'
                        : editingClinicaId
                          ? 'Guardar cambios'
                          : 'Crear clínica'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowClinicaForm(false);
                        setEditingClinicaId(null);
                      }}
                      className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="overflow-x-auto rounded-lg bg-white shadow-md">
                <table className="min-w-full text-sm">
                  <thead className="bg-blue-50 text-left">
                    <tr>
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Teléfono</th>
                      <th className="p-3">Ubicación</th>
                      <th className="p-3">Alta</th>
                      <th className="p-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinicasFiltradas.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="p-3 font-medium">{c.nombre}</td>
                        <td className="p-3">{c.email}</td>
                        <td className="p-3">{c.telefono}</td>
                        <td className="p-3">
                          {[c.ciudad, c.provincia].filter(Boolean).join(', ') || '—'}
                          {c.direccion ? (
                            <span className="block text-xs text-gray-500">{c.direccion}</span>
                          ) : null}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {c.creado_en
                            ? formatDateTime(c.creado_en)
                            : '—'}
                        </td>
                        <td className="p-3 space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditarClinica(c)}
                            className="text-blue-600 underline"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClinica(c)}
                            className="text-red-600 underline"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {clinicasFiltradas.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-gray-500">
                          {clinicas.length === 0
                            ? 'Todavía no hay clínicas. Usá “Nueva clínica” para crear una.'
                            : 'Ninguna clínica coincide con la búsqueda.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === 'tutores' ? (
            <div className="mb-10">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-blue-700">Tutores registrados</h2>
                  <p className="text-sm text-gray-600">
                    {tutores.length} tutor{tutores.length === 1 ? '' : 'es'} en total
                  </p>
                </div>
                <input
                  type="search"
                  value={registryQuery}
                  onChange={(e) => setRegistryQuery(e.target.value)}
                  placeholder="Buscar por nombre, email, teléfono…"
                  className="w-full max-w-md rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="overflow-x-auto rounded-lg bg-white shadow-md">
                <table className="min-w-full text-sm">
                  <thead className="bg-blue-50 text-left">
                    <tr>
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Teléfono</th>
                      <th className="p-3">Mascotas</th>
                      <th className="p-3">Alta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tutoresFiltrados.map((t) => (
                      <tr key={t.id} className="border-t">
                        <td className="p-3 font-medium">{t.nombre_completo}</td>
                        <td className="p-3">{t.email}</td>
                        <td className="p-3">
                          {t.telefono}
                          {t.telefono_secundario ? (
                            <span className="block text-xs text-gray-500">
                              {t.telefono_secundario}
                            </span>
                          ) : null}
                        </td>
                        <td className="p-3">{mascotasPorTutor.get(t.id) || 0}</td>
                        <td className="p-3 whitespace-nowrap">
                          {t.creado_en
                            ? formatDateTime(t.creado_en)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                    {tutoresFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-gray-500">
                          {tutores.length === 0
                            ? 'Todavía no hay tutores registrados.'
                            : 'Ningún tutor coincide con la búsqueda.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === 'chapitas' ? (
            <>
          <div className="mb-8 rounded-lg bg-white p-6 shadow-md">
            <h2 className="text-xl font-semibold text-blue-700 mb-3">Inventario de chapitas</h2>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm mb-4">
              <div className="rounded-md bg-blue-50 p-4">
                <p className="text-gray-600">Sin activar</p>
                <p className="text-3xl font-bold text-blue-800">{sinActivarTotal}</p>
                <p className="text-xs text-gray-500 mt-1">
                  de {stockTotal} (
                  {tiradaActual === 0
                    ? 'sin tiradas'
                    : `${tiradaActual} tirada${tiradaActual === 1 ? '' : 's'}`}
                  )
                </p>
              </div>
              <div className="rounded-md bg-green-50 p-4">
                <p className="text-gray-600">Activadas</p>
                <p className="text-3xl font-bold text-green-800">{activadasTotal}</p>
                {tiradaActual > 0 ? (
                  <button
                    type="button"
                    onClick={handleReiniciarInventario}
                    className="mt-3 text-xs text-red-700 underline"
                  >
                    Reiniciar inventario
                  </button>
                ) : null}
              </div>
              <div className="rounded-md border border-blue-100 bg-blue-50/70 p-4 space-y-3 sm:col-span-2 lg:col-span-1">
                <p className="text-sm font-medium text-blue-900">
                  Nueva tirada T{nextTirada}
                </p>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-700">
                    Cantidad de QR a generar
                  </span>
                  <select
                    value={nuevaTiradaCantidad}
                    onChange={(e) => setNuevaTiradaCantidad(Number(e.target.value))}
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  >
                    {TIRADA_CANTIDAD_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n} chapitas ({formatTiradaChapitaId(nextTirada, 1)}–
                        {formatTiradaChapitaId(nextTirada, n)})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-700">
                    Plantilla de QR
                  </span>
                  <select
                    value={nuevaTiradaPlantillaId}
                    onChange={(e) => setNuevaTiradaPlantillaId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">Estilo activo (Personalizar QR)</option>
                    {qrPlantillas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} · {p.estilo.tamano_ancho_cm ?? p.estilo.tamano_cm}×
                        {p.estilo.tamano_alto_cm ?? p.estilo.tamano_cm} cm · ECC{' '}
                        {p.estilo.complejidad}
                      </option>
                    ))}
                  </select>
                  {qrPlantillas.length === 0 ? (
                    <span className="mt-1 block text-xs text-amber-700">
                      No hay plantillas. Creá una en la pestaña Personalizar QR.
                    </span>
                  ) : null}
                </label>
                <button
                  type="button"
                  disabled={!canCreateBatch || creatingBatch || Boolean(zipProgress)}
                  onClick={handleCreateBatch}
                  className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingBatch || zipProgress
                    ? zipProgress
                      ? `Generando ${zipProgress.phase === 'pdf' ? 'PDF' : 'QR'}… ${zipProgress.done}/${zipProgress.total}`
                      : 'Creando tirada...'
                    : `Crear tirada ${nextTirada} (${nuevaTiradaCantidad} QR)`}
                </button>
                
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-blue-50 text-left">
                  <tr>
                    <th className="p-2">Tirada</th>
                    <th className="p-2">Sin activar</th>
                    <th className="p-2">Activadas</th>
                    <th className="p-2">Cantidad</th>
                    <th className="p-2">Plantilla</th>
                    <th className="p-2">Rango ID</th>
                    <th className="p-2">Archivos</th>
                    <th className="p-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tiradaStats.map((row) => {
                    const isUltima = row.tirada === tiradaActual;
                    const busy = zipProgress?.tirada === row.tirada;
                    return (
                      <tr key={row.tirada} className="border-t">
                        <td className="p-2 font-semibold">T{row.tirada}</td>
                        <td className="p-2">
                          {row.disponibles} / {row.cantidad}
                        </td>
                        <td className="p-2">
                          {row.activadas} / {row.cantidad}
                        </td>
                        <td className="p-2">
                          {row.cantidad}
                          {!row.definida ? (
                            <span className="ml-1 text-[10px] text-gray-400">(legado)</span>
                          ) : null}
                        </td>
                        <td className="p-2 min-w-[10rem]">
                          <span className="text-sm text-gray-800">
                            {plantillaLabel(row.plantilla_id, row.definida)}
                          </span>
                        </td>
                        <td className="p-2 font-mono text-xs">
                          {row.desde}–{row.hasta}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-col gap-1 items-start">
                            <button
                              type="button"
                              disabled={Boolean(zipProgress)}
                              onClick={() => handleDownloadTiradaZipOnly(row.tirada)}
                              className="text-blue-600 underline disabled:opacity-50"
                            >
                              {busy && zipProgress.phase === 'zip'
                                ? `ZIP ${zipProgress.done}/${zipProgress.total}`
                                : 'ZIP'}
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(zipProgress)}
                              onClick={() => handleDownloadTiradaPdfOnly(row.tirada)}
                              className="text-blue-600 underline disabled:opacity-50"
                            >
                              {busy && (zipProgress.phase === 'pdf' || zipProgress.phase === 'generar')
                                ? `PDF ${zipProgress.done}/${zipProgress.total}`
                                : 'PDF'}
                            </button>
                          </div>
                        </td>
                        <td className="p-2">
                          <button
                            type="button"
                            disabled={!isUltima || Boolean(zipProgress) || creatingBatch}
                            onClick={() => handleEliminarTirada(row.tirada)}
                            className="text-red-600 underline disabled:cursor-not-allowed disabled:opacity-40"
                            title={
                              isUltima
                                ? 'Eliminar esta tirada'
                                : 'Solo se puede eliminar la última tirada'
                            }
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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
                            ? formatDateTime(m.creado_en)
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
          ) : null}
        </>
      )}
    </section>
  );
}
