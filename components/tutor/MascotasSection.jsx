"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cardClass, primaryBtnClass } from "@/components/tutor/ui";
import { listarMascotasTutorCompletas } from "@/lib/chapitas/tutorPortal";

export default function MascotasSection({ tutor }) {
  const [mascotas, setMascotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await listarMascotasTutorCompletas(tutor.id, tutor.email);
        if (!cancelled) setMascotas(data.mascotas);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar las mascotas.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tutor.id, tutor.email]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-aguara-ink">Mis mascotas</h2>
          <p className="text-sm text-stone-500">Foto, nombre, especie, raza y edad</p>
        </div>
        <Link href="/mascota/T1-001" className={primaryBtnClass}>
          Vincular chapita
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className={cardClass}>
        {loading ? (
          <p className="text-sm text-stone-500">Cargando…</p>
        ) : mascotas.length === 0 ? (
          <p className="text-sm text-stone-600">
            Todavía no tenés mascotas. Activá una chapita QR o pedile a tu clínica que te registre.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {mascotas.map((m) => {
              const href = m.chapita_id ? `/mascota/${m.chapita_id}` : null;
              const content = (
                <>
                  {m.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.foto_url}
                      alt=""
                      className="size-16 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="grid size-16 place-items-center rounded-2xl bg-aguara-cream text-xl font-semibold text-aguara-orange">
                      {m.nombre?.charAt(0)?.toUpperCase() || "·"}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-aguara-ink">{m.nombre}</span>
                    <span className="mt-1 block text-sm text-stone-600">
                      {m.especie}
                      {m.raza ? ` · ${m.raza}` : ""}
                    </span>
                    <span className="mt-1 block text-sm text-stone-500">
                      {m.edad || "Edad sin cargar"}
                      {m.chapita_id ? ` · Chapita ${m.chapita_id}` : ""}
                    </span>
                  </span>
                </>
              );

              return (
                <li key={m.key}>
                  {href ? (
                    <Link
                      href={href}
                      className="flex items-center gap-4 rounded-2xl border border-stone-100 p-3 transition hover:border-aguara-orange/40 hover:bg-aguara-cream/30"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-4 rounded-2xl border border-stone-100 p-3">
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
