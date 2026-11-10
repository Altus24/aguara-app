"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import AgendaSection from "@/components/clinica/AgendaSection";
import ClientesSection from "@/components/clinica/ClientesSection";
import ConfigSection from "@/components/clinica/ConfigSection";
import DashboardSection from "@/components/clinica/DashboardSection";
import HistoriasSection from "@/components/clinica/HistoriasSection";
import PacientesSection from "@/components/clinica/PacientesSection";
import { useClinicAuth } from "@/context/ClinicAuthContext";

const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "pacientes", label: "Pacientes" },
  { id: "agenda", label: "Agenda" },
  { id: "historias", label: "Historias" },
  { id: "clientes", label: "Clientes" },
  { id: "config", label: "Configuración" },
];

export default function ClinicaPanel() {
  const { clinica, isAuthenticated, authLoading, signOut, refreshClinica } = useClinicAuth();
  const router = useRouter();
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/clinica/login?from=/clinica");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated || !clinica) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-stone-500">
        Cargando…
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-aguara-orange">Panel clínica</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-aguara-ink">
            {clinica.nombre}
          </h1>
          <p className="mt-2 text-sm text-stone-600">{clinica.email}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            signOut();
            router.replace("/clinica/login");
          }}
          className="inline-flex h-10 items-center justify-center rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 hover:border-stone-400"
        >
          Cerrar sesión
        </button>
      </div>

      <nav className="mt-8 flex gap-2 overflow-x-auto border-b border-stone-200 pb-3">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === item.id
                ? "bg-aguara-orange text-white"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "dashboard" ? (
          <DashboardSection clinicaId={clinica.id} onNavigate={setTab} />
        ) : null}
        {tab === "pacientes" ? <PacientesSection clinicaId={clinica.id} /> : null}
        {tab === "agenda" ? <AgendaSection clinicaId={clinica.id} /> : null}
        {tab === "historias" ? <HistoriasSection clinicaId={clinica.id} /> : null}
        {tab === "clientes" ? <ClientesSection clinicaId={clinica.id} /> : null}
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
