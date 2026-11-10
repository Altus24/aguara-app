"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useTutorAuth } from "@/context/TutorAuthContext";
import { listarMascotasDelTutor } from "@/lib/chapitas/tutores";

export default function TutorPanel() {
  const { tutor, isAuthenticated, authLoading, signOut } = useTutorAuth();
  const router = useRouter();
  const [mascotas, setMascotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/tutor/login?from=/tutor");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!tutor?.id) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const rows = await listarMascotasDelTutor(tutor.id);
        if (!cancelled) setMascotas(rows);
      } catch {
        if (!cancelled) setError("No se pudieron cargar tus mascotas.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tutor?.id]);

  if (authLoading || !isAuthenticated) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-stone-500">
        Cargando…
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-aguara-orange">Mi cuenta</p>
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

      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-aguara-ink">Tus mascotas</h2>
          <Link
            href="/mascota/T1-001"
            className="text-sm font-medium text-aguara-orange hover:text-aguara-orange-deep"
          >
            Vincular otra
          </Link>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-stone-500">Cargando mascotas…</p>
        ) : error ? (
          <p className="mt-6 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : mascotas.length === 0 ? (
          <p className="mt-6 text-sm text-stone-600">
            Todavía no tenés mascotas vinculadas. Activá una chapita para registrar la primera.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-stone-100">
            {mascotas.map((mascota) => (
              <li key={mascota.id}>
                <Link
                  href={`/mascota/${mascota.id}`}
                  className="flex items-center gap-3 py-4 transition hover:bg-stone-50"
                >
                  {mascota.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mascota.foto_url}
                      alt=""
                      className="size-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid size-12 place-items-center rounded-full bg-aguara-cream font-medium text-aguara-orange">
                      {mascota.nombre_mascota?.charAt(0)?.toUpperCase() || "·"}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-aguara-ink">
                      {mascota.nombre_mascota}
                    </span>
                    <span className="block text-sm text-stone-500">
                      {mascota.especie || "Mascota"} · Chapita {mascota.id}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-8 text-center">
        <Link href="/" className="text-sm text-stone-500 underline hover:text-aguara-ink">
          Volver al inicio
        </Link>
      </p>
    </section>
  );
}
