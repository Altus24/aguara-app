"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import PushEnableControl from "@/components/chapitas/PushEnableControl";
import AgendaSection from "@/components/clinica/AgendaSection";
import ClientesSection from "@/components/clinica/ClientesSection";
import ConfigSection from "@/components/clinica/ConfigSection";
import DashboardSection from "@/components/clinica/DashboardSection";
import HistoriasSection from "@/components/clinica/HistoriasSection";
import PacientesSection from "@/components/clinica/PacientesSection";
import TutoresDirectorySection from "@/components/clinica/TutoresDirectorySection";
import { ClinicaLogoMark } from "@/components/clinica/ui";
import { useClinicAuth } from "@/context/ClinicAuthContext";
import {
  listarCitasPendientes,
  listarNotificacionesClinica,
  marcarTodasNotificacionesLeidas,
} from "@/lib/chapitas/clinicaOps";
import {
  PLAZO_APROBACION_DIAS,
  clinicaEstaAprobada,
  clinicaEstaPendiente,
  clinicaEstaRechazada,
} from "@/lib/chapitas/clinicaRegistro";

const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "tutores", label: "Tutores" },
  { id: "pacientes", label: "Pacientes" },
  { id: "agenda", label: "Agenda" },
  { id: "historias", label: "Historias" },
  { id: "clientes", label: "Clientes" },
  { id: "config", label: "Configuración" },
];

const TAB_STORAGE_KEY = "aguara_clinica_panel_tab";
const NAV_IDS = new Set(NAV.map((item) => item.id));

function readStoredTab() {
  if (typeof window === "undefined") return "dashboard";
  try {
    const stored = window.sessionStorage.getItem(TAB_STORAGE_KEY);
    return NAV_IDS.has(stored) ? stored : "dashboard";
  } catch {
    return "dashboard";
  }
}

export default function ClinicaPanel() {
  const { clinica, isAuthenticated, authLoading, signOut, refreshClinica } = useClinicAuth();
  const router = useRouter();
  const [tab, setTab] = useState(readStoredTab);
  const [agendaFocusPendientes, setAgendaFocusPendientes] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [notifs, setNotifs] = useState([]);

  function selectTab(next) {
    setTab(next);
    try {
      window.sessionStorage.setItem(TAB_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function goAgenda({ focusPendientes = false } = {}) {
    setAgendaFocusPendientes(focusPendientes);
    selectTab("agenda");
    requestAnimationFrame(() => {
      document.getElementById("clinica-agenda")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/clinica/login?from=/clinica");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!clinica?.id) return;
    let cancelled = false;
    async function loadAlerts() {
      try {
        const [citas, rows] = await Promise.all([
          listarCitasPendientes(clinica.id, { soloHorarioVigente: true }),
          listarNotificacionesClinica(clinica.id, { soloNoLeidas: true }),
        ]);
        if (cancelled) return;
        setPendientes(citas.length);
        setNotifs(rows);
      } catch {
        if (!cancelled) {
          setPendientes(0);
          setNotifs([]);
        }
      }
    }
    loadAlerts();
    const timer = setInterval(loadAlerts, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [clinica?.id, tab]);

  if (authLoading || !isAuthenticated || !clinica) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-stone-500">
        Cargando…
      </section>
    );
  }

  if (!clinicaEstaAprobada(clinica)) {
    const pendiente = clinicaEstaPendiente(clinica);
    const rechazada = clinicaEstaRechazada(clinica);
    return (
      <section className="mx-auto w-full max-w-lg px-4 py-12">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-aguara-orange">Aguará · Clínicas</p>
          <h1 className="mt-2 text-2xl font-semibold text-aguara-ink">{clinica.nombre}</h1>
          <p className="mt-1 text-sm text-stone-600">{clinica.email}</p>

          {pendiente ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Perfil pendiente de aprobación</p>
              <p className="mt-1 leading-6">
                Aguará App revisará tu perfil en los siguientes {PLAZO_APROBACION_DIAS} días.
                Solo veterinarios matriculados pueden operar; tu director técnico ya quedó
                asociado a la solicitud.
              </p>
              <p className="mt-2 leading-6">
                Te avisamos cuando esté aprobado. Hasta entonces el panel permanece bloqueado.
              </p>
            </div>
          ) : null}

          {rechazada ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-semibold">Perfil rechazado</p>
              <p className="mt-1 leading-6">
                Esta solicitud no fue aprobada. Si creés que es un error, contactá a Aguará.
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              signOut();
              router.replace("/clinica/login");
            }}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 hover:border-stone-400"
          >
            Cerrar sesión
          </button>
        </div>
        <p className="mt-6 text-center">
          <Link href="/" className="text-sm text-stone-500 underline hover:text-aguara-ink">
            Volver al inicio
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <ClinicaLogoMark logoUrl={clinica.logo_url} nombre={clinica.nombre} size={56} />
          <div>
            <p className="text-sm font-medium text-aguara-orange">Panel clínica</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-aguara-ink">
              {clinica.nombre}
            </h1>
            <p className="mt-2 text-sm text-stone-600">{clinica.email}</p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <PushEnableControl audience="clinica" audienceId={clinica.id} />
          <button
            type="button"
            onClick={() => {
              signOut();
              router.replace("/clinica/login");
            }}
            className="text-sm text-stone-500 underline-offset-2 transition hover:text-aguara-ink hover:underline"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {pendientes > 0 || notifs.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {pendientes || notifs.length} turno
                {(pendientes || notifs.length) === 1 ? "" : "s"} pendiente
                {(pendientes || notifs.length) === 1 ? "" : "s"} de tutores
              </p>
              {notifs.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {notifs.slice(0, 3).map((n) => (
                    <li key={n.id}>{n.mensaje || n.titulo}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-amber-900/80">
                  Confirmalos desde la agenda para reservar el horario.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-aguara-orange px-4 py-2 text-sm font-medium text-white"
                onClick={() => goAgenda({ focusPendientes: true })}
              >
                Ir a agenda
              </button>
              {notifs.length > 0 ? (
                <button
                  type="button"
                  className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm text-amber-900"
                  onClick={async () => {
                    await marcarTodasNotificacionesLeidas(clinica.id);
                    setNotifs([]);
                  }}
                >
                  Marcar leídas
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <nav className="mt-8 flex gap-2 overflow-x-auto border-b border-stone-200 pb-3">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() =>
              item.id === "agenda" && pendientes > 0
                ? goAgenda({ focusPendientes: true })
                : selectTab(item.id)
            }
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === item.id
                ? "bg-aguara-orange text-white"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            {item.label}
            {item.id === "agenda" && pendientes > 0 ? (
              <span className="ml-2 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">
                {pendientes}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "dashboard" ? (
          <DashboardSection
            clinicaId={clinica.id}
            onNavigate={(next) =>
              next === "agenda" ? goAgenda({ focusPendientes: true }) : selectTab(next)
            }
          />
        ) : null}
        {tab === "tutores" ? (
          <TutoresDirectorySection clinicaId={clinica.id} clinicaNombre={clinica.nombre} />
        ) : null}
        {tab === "pacientes" ? <PacientesSection clinicaId={clinica.id} /> : null}
        {tab === "agenda" ? (
          <div id="clinica-agenda">
            <AgendaSection
              clinicaId={clinica.id}
              focusPendientes={agendaFocusPendientes}
              onFocusPendientesConsumed={() => setAgendaFocusPendientes(false)}
            />
          </div>
        ) : null}
        {tab === "historias" ? <HistoriasSection clinicaId={clinica.id} /> : null}
        {tab === "clientes" ? (
          <ClientesSection clinicaId={clinica.id} clinicaNombre={clinica.nombre} />
        ) : null}
        {tab === "config" ? (
          <ConfigSection clinica={clinica} onSaved={refreshClinica} />
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
