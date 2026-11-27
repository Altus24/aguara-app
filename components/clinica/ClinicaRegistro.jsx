"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useClinicAuth } from "@/context/ClinicAuthContext";
import { PLAZO_APROBACION_DIAS } from "@/lib/chapitas/clinicaRegistro";
import {
  ciudadesDeProvincia,
  provinciaPorDefecto,
  provinciasDisponibles,
} from "@/lib/chapitas/ubicacionesAr";

const fieldClass =
  "w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-aguara-ink outline-none focus:border-aguara-orange focus:ring-4 focus:ring-aguara-orange/15";

const emptyForm = {
  nombre: "",
  email: "",
  password: "",
  telefono: "",
  direccion: "",
  ciudad: "",
  provincia: provinciaPorDefecto(),
  descripcion: "",
  director_nombre: "",
  director_matricula: "",
  director_especialidad: "",
  director_email: "",
};

export default function ClinicaRegistro() {
  const { register, isAuthenticated, authLoading } = useClinicAuth();
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const provincias = useMemo(() => provinciasDisponibles(), []);
  const ciudades = useMemo(() => ciudadesDeProvincia(form.provincia), [form.provincia]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/clinica");
    }
  }, [authLoading, isAuthenticated, router]);

  function updateField(key) {
    return (event) => {
      const value = event.target.value;
      setForm((prev) => {
        if (key === "provincia") {
          const nextCiudades = ciudadesDeProvincia(value);
          return {
            ...prev,
            provincia: value,
            ciudad: nextCiudades.includes(prev.ciudad) ? prev.ciudad : "",
          };
        }
        return { ...prev, [key]: value };
      });
    };
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
        Solo veterinarios matriculados pueden crear una cuenta. Debés designar un director
        técnico al crear el perfil.
      </p>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-semibold">Aprobación de Aguará</p>
        <p className="mt-1 leading-6">
          Después de registrarte, el perfil deberá ser aprobado por Aguará App en los siguientes{" "}
          {PLAZO_APROBACION_DIAS} días. Hasta entonces no vas a poder usar el panel completo.
        </p>
      </div>

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
            <label
              htmlFor="reg-provincia"
              className="mb-1 block text-sm font-medium text-stone-800"
            >
              Provincia
            </label>
            <select
              id="reg-provincia"
              required
              value={form.provincia}
              onChange={updateField("provincia")}
              className={fieldClass}
            >
              {provincias.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="reg-ciudad" className="mb-1 block text-sm font-medium text-stone-800">
              Ciudad / departamento
            </label>
            <select
              id="reg-ciudad"
              required
              value={form.ciudad}
              onChange={updateField("ciudad")}
              className={fieldClass}
              disabled={!ciudades.length}
            >
              <option value="">Seleccioná…</option>
              {ciudades.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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

        <div className="border-t border-stone-100 pt-4">
          <h2 className="text-sm font-semibold text-aguara-ink">Director técnico</h2>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            Obligatorio. Debe ser un veterinario matriculado; queda asociado al perfil de la
            clínica.
          </p>
          <div className="mt-3 space-y-4">
            <div>
              <label
                htmlFor="reg-dir-nombre"
                className="mb-1 block text-sm font-medium text-stone-800"
              >
                Nombre y apellido
              </label>
              <input
                id="reg-dir-nombre"
                required
                minLength={2}
                value={form.director_nombre}
                onChange={updateField("director_nombre")}
                className={fieldClass}
                placeholder="Ej.: Dra. María López"
              />
            </div>
            <div>
              <label
                htmlFor="reg-dir-matricula"
                className="mb-1 block text-sm font-medium text-stone-800"
              >
                Matrícula profesional
              </label>
              <input
                id="reg-dir-matricula"
                required
                minLength={2}
                value={form.director_matricula}
                onChange={updateField("director_matricula")}
                className={fieldClass}
                placeholder="Ej.: MP 12345"
              />
            </div>
            <div>
              <label
                htmlFor="reg-dir-esp"
                className="mb-1 block text-sm font-medium text-stone-800"
              >
                Especialidad (opcional)
              </label>
              <input
                id="reg-dir-esp"
                value={form.director_especialidad}
                onChange={updateField("director_especialidad")}
                className={fieldClass}
              />
            </div>
            <div>
              <label
                htmlFor="reg-dir-email"
                className="mb-1 block text-sm font-medium text-stone-800"
              >
                Email del director (opcional)
              </label>
              <input
                id="reg-dir-email"
                type="email"
                value={form.director_email}
                onChange={updateField("director_email")}
                className={fieldClass}
                placeholder="Si queda vacío, se usa el email de la clínica"
              />
            </div>
          </div>
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
          {submitting ? "Registrando…" : "Solicitar alta"}
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
