"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import AgendaSection from "@/components/tutor/AgendaSection";
import HistorialSection from "@/components/tutor/HistorialSection";
import MascotasSection from "@/components/tutor/MascotasSection";
import PerfilSection from "@/components/tutor/PerfilSection";
import RecordatoriosSection from "@/components/tutor/RecordatoriosSection";
import { useTutorAuth } from "@/context/TutorAuthContext";

const NAV = [
  { id: "mascotas", label: "Mis mascotas" },
  { id: "agenda", label: "Mis citas" },
  { id: "historial", label: "Historial clínico" },
  { id: "recordatorios", label: "Recordatorios" },
  { id: "perfil", label: "Perfil" },
];

export default function TutorPanel() {
  const { tutor, isAuthenticated, authLoading, signOut } = useTutorAuth();
  const router = useRouter();
  const [tab, setTab] = useState("mascotas");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/tutor/login?from=/tutor");
    }
  }, [authLoading, isAuthenticated, router]);

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
        <button
          type="button"
          onClick={() => {
            signOut();
            router.replace("/tutor/login");
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
        {tab === "mascotas" ? <MascotasSection tutor={tutor} /> : null}
        {tab === "agenda" ? <AgendaSection tutor={tutor} /> : null}
        {tab === "historial" ? <HistorialSection tutor={tutor} /> : null}
        {tab === "recordatorios" ? <RecordatoriosSection tutor={tutor} /> : null}
        {tab === "perfil" ? <PerfilSection tutor={tutor} /> : null}
      </div>

      <p className="mt-10 text-center">
        <Link href="/" className="text-sm text-stone-500 underline hover:text-aguara-ink">
          Volver al inicio
        </Link>
      </p>
    </section>
  );
}
