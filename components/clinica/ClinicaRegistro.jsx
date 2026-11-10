"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useClinicAuth } from "@/context/ClinicAuthContext";

const fieldClass =
  "w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-aguara-ink outline-none focus:border-aguara-orange focus:ring-4 focus:ring-aguara-orange/15";

const emptyForm = {
  nombre: "",
  email: "",
  password: "",
  telefono: "",
  direccion: "",
  ciudad: "",
  provincia: "Mendoza",
  descripcion: "",
};

export default function ClinicaRegistro() {
  const { register, isAuthenticated, authLoading } = useClinicAuth();
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/clinica");
    }
  }, [authLoading, isAuthenticated, router]);

  function updateField(key) {
    return (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(form);
      router.replace("/clinica");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la clínica.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!authLoading && isAuthenticated) {
    return (
      <section className="mx-auto max-w-md px-4 py-16 text-center text-sm text-stone-500">
        Redirigiendo al panel…
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-lg px-4 py-12">
      <p className="text-center text-sm font-medium text-aguara-orange">Clínicas</p>
      <h1 className="mt-2 text-center text-2xl font-semibold tracking-tight text-aguara-ink">
        Registrar clínica
      </h1>
      <p className="mt-2 text-center text-sm leading-6 text-stone-600">
        Creá tu cuenta para cargar ubicación, servicios, horarios y stock. Por ahora la
        contraseña es el mismo email.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="reg-nombre" className="mb-1 block text-sm font-medium text-stone-800">
            Nombre de la clínica
          </label>
          <input
            id="reg-nombre"
            required
            minLength={2}
            value={form.nombre}
            onChange={updateField("nombre")}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="reg-email" className="mb-1 block text-sm font-medium text-stone-800">
            Email
          </label>
          <input
            id="reg-email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={updateField("email")}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="reg-password" className="mb-1 block text-sm font-medium text-stone-800">
            Contraseña
          </label>
          <input
            id="reg-password"
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={updateField("password")}
            className={fieldClass}
          />
          <p className="mt-1.5 text-xs text-stone-500">Temporal: repetí el email como contraseña.</p>
        </div>
        <div>
          <label htmlFor="reg-telefono" className="mb-1 block text-sm font-medium text-stone-800">
            Teléfono
          </label>
          <input
            id="reg-telefono"
            required
            minLength={6}
            value={form.telefono}
            onChange={updateField("telefono")}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="reg-direccion" className="mb-1 block text-sm font-medium text-stone-800">
            Dirección
          </label>
          <input
            id="reg-direccion"
            required
            value={form.direccion}
            onChange={updateField("direccion")}
            className={fieldClass}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="reg-ciudad" className="mb-1 block text-sm font-medium text-stone-800">
              Ciudad
            </label>
            <input
              id="reg-ciudad"
              required
              value={form.ciudad}
              onChange={updateField("ciudad")}
              className={fieldClass}
            />
          </div>
          <div>
            <label
              htmlFor="reg-provincia"
              className="mb-1 block text-sm font-medium text-stone-800"
            >
              Provincia
            </label>
            <input
              id="reg-provincia"
              value={form.provincia}
              onChange={updateField("provincia")}
              className={fieldClass}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="reg-descripcion"
            className="mb-1 block text-sm font-medium text-stone-800"
          >
            Descripción (opcional)
          </label>
          <textarea
            id="reg-descripcion"
            rows={3}
            value={form.descripcion}
            onChange={updateField("descripcion")}
            className={fieldClass}
          />
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
          {submitting ? "Registrando…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-stone-500">
        ¿Ya tenés cuenta?{" "}
        <Link
          href="/clinica/login"
          className="font-medium text-aguara-orange hover:text-aguara-orange-deep"
        >
          Iniciar sesión
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
