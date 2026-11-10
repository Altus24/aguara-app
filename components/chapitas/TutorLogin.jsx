"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useTutorAuth } from "@/context/TutorAuthContext";

const fieldClass =
  "w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-aguara-ink outline-none focus:border-aguara-orange focus:ring-4 focus:ring-aguara-orange/15";

export default function TutorLogin() {
  const { signIn, isAuthenticated, authLoading } = useTutorAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = searchParams.get("from") || "/tutor";

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [authLoading, isAuthenticated, redirectTo, router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!authLoading && isAuthenticated) {
    return (
      <section className="mx-auto max-w-md px-4 py-16 text-center text-sm text-stone-500">
        Redirigiendo a tu cuenta…
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-md px-4 py-12">
      <p className="text-center text-sm font-medium text-aguara-orange">Acceso tutores</p>
      <h1 className="mt-2 text-center text-2xl font-semibold tracking-tight text-aguara-ink">
        Iniciar sesión
      </h1>
      <p className="mt-2 text-center text-sm leading-6 text-stone-600">
        Usá el email con el que registraste tus mascotas. Por ahora la contraseña es el mismo
        email.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="tutor-email" className="mb-1 block text-sm font-medium text-stone-800">
            Email
          </label>
          <input
            id="tutor-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="tutor-password" className="mb-1 block text-sm font-medium text-stone-800">
            Contraseña
          </label>
          <input
            id="tutor-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass}
          />
          <p className="mt-1.5 text-xs text-stone-500">Temporal: ingresá nuevamente tu email.</p>
        </div>

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-aguara-orange px-5 text-sm font-medium text-white transition hover:bg-aguara-orange-deep disabled:opacity-60"
        >
          {submitting ? "Ingresando…" : "Ingresar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-stone-500">
        ¿Todavía no tenés cuenta?{" "}
        <Link href="/mascota/T1-001" className="font-medium text-aguara-orange hover:text-aguara-orange-deep">
          Activá una chapita
        </Link>
      </p>
      <p className="mt-3 text-center">
        <Link href="/" className="text-sm text-stone-500 underline hover:text-aguara-ink">
          Volver al inicio
        </Link>
      </p>
    </section>
  );
}
