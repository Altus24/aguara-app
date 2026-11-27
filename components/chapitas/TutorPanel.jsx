"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import PushEnableControl from "@/components/chapitas/PushEnableControl";
import AgendaSection from "@/components/tutor/AgendaSection";
import HistorialSection from "@/components/tutor/HistorialSection";
import MascotasSection from "@/components/tutor/MascotasSection";
import PerfilSection from "@/components/tutor/PerfilSection";
import PermisosSection from "@/components/tutor/PermisosSection";
import RecordatoriosSection from "@/components/tutor/RecordatoriosSection";
import { useTutorAuth } from "@/context/TutorAuthContext";
import {
  actualizarTutor,
  listarNotificacionesTutor,
  listarSolicitudesCompartirTutor,
  listarSolicitudesPerfilTutor,
  marcarNotificacionesTutorLeidas,
} from "@/lib/chapitas/tutorPortal";

const TIPOS_CITA_NOTIF = new Set(["cita_confirmada", "cita_cancelada", "cita_reprogramada"]);
const TIPOS_ESCANEO_NOTIF = new Set(["qr_escaneo"]);

const NAV = [
  { id: "recordatorios", label: "Recordatorios" },
  { id: "mascotas", label: "Mis mascotas" },
  { id: "agenda", label: "Mis citas" },
  { id: "historial", label: "Historial clínico" },
  { id: "permisos", label: "Permisos" },
  { id: "perfil", label: "Perfil" },
];

const ALLOWED_TABS = new Set(NAV.map((item) => item.id));
const DEFAULT_TAB = "recordatorios";

export default function TutorPanel() {
  const { tutor, isAuthenticated, authLoading, signOut, refreshTutor } = useTutorAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_TAB;
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("tab");
      const stored = window.sessionStorage.getItem("aguara_tutor_panel_tab");
      if (ALLOWED_TABS.has(fromUrl)) return fromUrl;
      return ALLOWED_TABS.has(stored) ? stored : DEFAULT_TAB;
    } catch {
      return DEFAULT_TAB;
    }
  });
  const [pendientesPerfil, setPendientesPerfil] = useState(0);
  const [notifMensaje, setNotifMensaje] = useState("");
  const [notifCita, setNotifCita] = useState(null);
  const [notifEscaneo, setNotifEscaneo] = useState(null);
  const [agendaPrefill, setAgendaPrefill] = useState(null);

  function selectTab(next) {
    setTab(next);
    try {
      window.sessionStorage.setItem("aguara_tutor_panel_tab", next);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/tutor/login?from=/tutor");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (ALLOWED_TABS.has(tabParam)) selectTab(tabParam);

    const sacar = searchParams.get("sacar") === "1";
    const mascota = searchParams.get("mascota");
    if (sacar || mascota) {
      setAgendaPrefill({
        openForm: sacar,
        mascotaId: mascota || null,
      });
      if (sacar) selectTab("agenda");
      router.replace("/tutor", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function loadAlerts() {
    if (!tutor?.id) return;
    try {
      const [sols, shares, notifs] = await Promise.all([
        listarSolicitudesPerfilTutor(tutor.id, { soloPendientes: true }),
        listarSolicitudesCompartirTutor(tutor.id, { soloPendientes: true }),
        listarNotificacionesTutor(tutor.id, { soloNoLeidas: true }),
      ]);
      setPendientesPerfil(sols.length + shares.length);
      const citaNotif = notifs.find((n) => TIPOS_CITA_NOTIF.has(n.tipo)) || null;
      setNotifCita(citaNotif);
      const escaneoNotif = notifs.find((n) => TIPOS_ESCANEO_NOTIF.has(n.tipo)) || null;
      setNotifEscaneo(escaneoNotif);
      const perfilNotifs = notifs.filter(
        (n) => !TIPOS_CITA_NOTIF.has(n.tipo) && !TIPOS_ESCANEO_NOTIF.has(n.tipo),
      );
      setNotifMensaje(
        perfilNotifs[0]?.mensaje ||
          shares[0]?.clinicas?.nombre ||
          sols[0]?.clinicas?.nombre ||
          "",
      );
    } catch {
      setPendientesPerfil(0);
      setNotifMensaje("");
      setNotifCita(null);
      setNotifEscaneo(null);
    }
  }

  useEffect(() => {
    loadAlerts();
    const timer = setInterval(loadAlerts, 30000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutor?.id, tab]);

  if (authLoading || !isAuthenticated || !tutor) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-stone-500">
        Cargando…
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-aguara-orange">Portal tutores</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-aguara-ink">
            Hola, {tutor.nombre_completo}
          </h1>
          <p className="mt-2 text-sm text-stone-600">{tutor.email}</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <PushEnableControl
            audience="tutor"
            audienceId={tutor.id}
            onEnabledChange={async (enabled) => {
              try {
                const updated = await actualizarTutor(tutor.id, {
                  nombre_completo: tutor.nombre_completo || "",
                  telefono: tutor.telefono || "",
                  telefono_secundario: tutor.telefono_secundario,
                  direccion: tutor.direccion,
                  dni: tutor.dni,
                  clinica_preferida_id: tutor.clinica_preferida_id,
                  calle: tutor.calle,
                  numeracion: tutor.numeracion,
                  tipo_vivienda: tutor.tipo_vivienda,
                  piso_depto: tutor.piso_depto,
                  localidad: tutor.localidad,
                  provincia: tutor.provincia,
                  maps_url: tutor.maps_url,
                  recordatorio_anticipacion: tutor.recordatorio_anticipacion,
                  recordatorio_canales: tutor.recordatorio_canales,
                  notif_push_mobile: enabled,
                });
                refreshTutor?.({ ...tutor, ...updated, email: tutor.email });
              } catch {
                /* la suscripción push ya quedó; el flag es secundario */
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              signOut();
              router.replace("/tutor/login");
            }}
            className="text-sm text-stone-500 underline-offset-2 transition hover:text-aguara-ink hover:underline"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {notifEscaneo ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-950">{notifEscaneo.titulo}</p>
              <p className="mt-1 text-sm text-emerald-900/80">{notifEscaneo.mensaje}</p>
            </div>
            <button
              type="button"
              className="rounded-full bg-aguara-orange px-4 py-2 text-sm font-medium text-white"
              onClick={async () => {
                selectTab("mascotas");
                try {
                  await marcarNotificacionesTutorLeidas(tutor.id, { soloTiposEscaneo: true });
                  setNotifEscaneo(null);
                } catch {
                  /* ignore */
                }
              }}
            >
              Ver mis mascotas
            </button>
          </div>
        </div>
      ) : null}

      {notifCita ? (
        <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-sky-950">{notifCita.titulo}</p>
              <p className="mt-1 text-sm text-sky-900/80">{notifCita.mensaje}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-aguara-orange px-4 py-2 text-sm font-medium text-white"
                onClick={async () => {
                  selectTab("agenda");
                  try {
                    await marcarNotificacionesTutorLeidas(tutor.id, { soloTiposCita: true });
                    setNotifCita(null);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Ver mis citas
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendientesPerfil > 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-950">
                {pendientesPerfil} solicitud{pendientesPerfil === 1 ? "" : "es"} pendiente
                {pendientesPerfil === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-sm text-amber-900/80">
                {notifMensaje ||
                  "Hay pedidos de clínicas (perfil o cambios de datos). Revisá en Perfil."}
              </p>
            </div>
            <button
              type="button"
              className="rounded-full bg-aguara-orange px-4 py-2 text-sm font-medium text-white"
              onClick={() => selectTab("perfil")}
            >
              Revisar en perfil
            </button>
          </div>
        </div>
      ) : null}

      <nav className="mt-8 flex gap-2 overflow-x-auto border-b border-stone-200 pb-3">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectTab(item.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === item.id
                ? "bg-aguara-orange text-white"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            {item.label}
            {item.id === "perfil" && pendientesPerfil > 0 ? (
              <span className="ml-2 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">
                {pendientesPerfil}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "mascotas" ? <MascotasSection tutor={tutor} /> : null}
        {tab === "agenda" ? (
          <AgendaSection
            tutor={tutor}
            prefill={agendaPrefill}
            onPrefillConsumed={() => setAgendaPrefill(null)}
          />
        ) : null}
        {tab === "historial" ? <HistorialSection tutor={tutor} /> : null}
        {tab === "recordatorios" ? <RecordatoriosSection tutor={tutor} /> : null}
        {tab === "permisos" ? <PermisosSection tutor={tutor} /> : null}
        {tab === "perfil" ? (
          <PerfilSection tutor={tutor} onSolicitudesChange={loadAlerts} />
        ) : null}
      </div>

      <p className="mt-10 text-center">
        <Link href="/" className="text-sm text-stone-500 underline hover:text-aguara-ink">
          Volver al inicio
        </Link>
      </p>
    </section>
  );
}
