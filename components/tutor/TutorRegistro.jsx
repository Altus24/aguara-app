"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import MascotaRegistroFields, {
  EMPTY_PET_FORM,
  validateMascotaRegistroForm,
} from "@/components/mascotas/MascotaRegistroFields";
import { useTutorAuth } from "@/context/TutorAuthContext";
import { listarClinicas } from "@/lib/chapitas/tutorPortal";
import { confirmGuardar } from "@/lib/confirmAction";

const fieldClass =
  "w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-aguara-ink outline-none focus:border-aguara-orange focus:ring-4 focus:ring-aguara-orange/15";

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

const emptyTutor = {
  nombreCompleto: "",
  email: "",
  password: "",
  telefono: "",
  telefonoSecundario: "",
  direccion: "",
  dni: "",
};

export default function TutorRegistro() {
  const { register, isAuthenticated, authLoading } = useTutorAuth();
  const router = useRouter();
  const [tutorForm, setTutorForm] = useState(emptyTutor);
  const [petForm, setPetForm] = useState(EMPTY_PET_FORM);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);
  const [clinicas, setClinicas] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/tutor");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    listarClinicas()
      .then(setClinicas)
      .catch(() => setClinicas([]));
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  function updateTutor(key) {
    return (event) => setTutorForm((prev) => ({ ...prev, [key]: event.target.value }));
  }

  function handlePhoto(event) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
      setFoto(null);
      setPreview(null);
      return;
    }
    if (!PHOTO_TYPES.has(file.type)) {
      setError("La foto tiene que ser JPG, PNG o WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("La foto no puede superar 4 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setFoto(file);
    setPreview(url);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const nombre = tutorForm.nombreCompleto.trim();
    if (nombre.length < 2) {
      setError("Ingresá el nombre del tutor.");
      return;
    }
    const phoneDigits = String(tutorForm.telefono || "").replace(/\D/g, "");
    if (phoneDigits.length < 8) {
      setError("Ingresá un teléfono válido (mínimo 8 dígitos).");
      return;
    }
    const invalidPet = validateMascotaRegistroForm(petForm);
    if (invalidPet) {
      setError(invalidPet);
      return;
    }

    if (
      !(await confirmGuardar(
        `tu cuenta y la mascota “${String(petForm.nombre_mascota || "").trim()}”`,
      ))
    ) {
      return;
    }

    setSubmitting(true);
    try {
      await register({
        tutor: tutorForm,
        mascota: petForm,
        foto,
      });
      router.replace("/tutor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar.");
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
    <section className="mx-auto w-full max-w-2xl px-4 py-12">
      <p className="text-center text-sm font-medium text-aguara-orange">Tutores</p>
      <h1 className="mt-2 text-center text-2xl font-semibold tracking-tight text-aguara-ink">
        Crear cuenta
      </h1>
      <p className="mt-2 text-center text-sm leading-6 text-stone-600">
        Registrá tus datos y la primera mascota. Después podés vincular un identificador QR o sumar más
        animales desde el panel. Por ahora la contraseña es el mismo email.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-aguara-ink">Tus datos</h2>
          <div>
            <label htmlFor="reg-tutor-nombre" className="mb-1 block text-sm font-medium text-stone-800">
              Nombre completo
            </label>
            <input
              id="reg-tutor-nombre"
              required
              minLength={2}
              value={tutorForm.nombreCompleto}
              onChange={updateTutor("nombreCompleto")}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="reg-tutor-email" className="mb-1 block text-sm font-medium text-stone-800">
              Email
            </label>
            <input
              id="reg-tutor-email"
              type="email"
              required
              autoComplete="email"
              value={tutorForm.email}
              onChange={updateTutor("email")}
              className={fieldClass}
            />
          </div>
          <div>
            <label
              htmlFor="reg-tutor-password"
              className="mb-1 block text-sm font-medium text-stone-800"
            >
              Contraseña
            </label>
            <input
              id="reg-tutor-password"
              type="password"
              required
              autoComplete="new-password"
              value={tutorForm.password}
              onChange={updateTutor("password")}
              className={fieldClass}
            />
            <p className="mt-1.5 text-xs text-stone-500">Temporal: repetí el email como contraseña.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reg-tutor-tel"
                className="mb-1 block text-sm font-medium text-stone-800"
              >
                Teléfono
              </label>
              <input
                id="reg-tutor-tel"
                required
                minLength={8}
                value={tutorForm.telefono}
                onChange={updateTutor("telefono")}
                className={fieldClass}
              />
            </div>
            <div>
              <label
                htmlFor="reg-tutor-tel2"
                className="mb-1 block text-sm font-medium text-stone-800"
              >
                Teléfono secundario (opcional)
              </label>
              <input
                id="reg-tutor-tel2"
                value={tutorForm.telefonoSecundario}
                onChange={updateTutor("telefonoSecundario")}
                className={fieldClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="reg-tutor-dni" className="mb-1 block text-sm font-medium text-stone-800">
              DNI (opcional)
            </label>
            <input
              id="reg-tutor-dni"
              inputMode="numeric"
              autoComplete="off"
              value={tutorForm.dni}
              onChange={updateTutor("dni")}
              className={fieldClass}
              placeholder="Documento del tutor"
            />
          </div>
          <div>
            <label
              htmlFor="reg-tutor-dir"
              className="mb-1 block text-sm font-medium text-stone-800"
            >
              Dirección (opcional)
            </label>
            <input
              id="reg-tutor-dir"
              value={tutorForm.direccion}
              onChange={updateTutor("direccion")}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-stone-100 pt-6">
          <div>
            <h2 className="text-lg font-semibold text-aguara-ink">Tu mascota</h2>
            <p className="mt-1 text-sm text-stone-500">
              Se crea sin identificador. Cuando tengas el QR, lo vinculás desde el panel.
            </p>
          </div>
          <MascotaRegistroFields
            form={petForm}
            onChange={(name, value) => setPetForm((f) => ({ ...f, [name]: value }))}
            preview={preview}
            onPhoto={handlePhoto}
            fieldClass={fieldClass}
            fotoInputId="reg-tutor-foto"
            showTitle={false}
            clinicas={clinicas}
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
          href="/tutor/login"
          className="font-medium text-aguara-orange hover:text-aguara-orange-deep"
        >
          Iniciar sesión
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-stone-500">
        ¿Tenés identificador físico?{" "}
        <Link
          href="/mascota/T1-001"
          className="font-medium text-aguara-orange hover:text-aguara-orange-deep"
        >
          Activá el QR
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
