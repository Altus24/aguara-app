"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, Field, inputClass, primaryButtonClass } from "@/components/ui/form";
import { createPatient } from "@/lib/actions/patients";
import { uploadPatientPhoto } from "@/lib/storage";
import type { OwnerOption } from "@/lib/types";
import {
  patientFormSchema,
  SPECIES,
  SEXES,
  validatePhoto,
  type PatientFormValues,
} from "@/lib/validations";

export function PatientForm({ owners }: { owners: OwnerOption[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  const [ownerMode, setOwnerMode] = useState<PatientFormValues["ownerMode"]>("new");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      ownerMode: "new",
      ownerId: "",
      fullName: "",
      dni: "",
      phone: "",
      email: "",
      name: "",
      species: "Perro",
      breed: "",
      sex: "Desconocido",
      birthDate: "",
      weightKg: "",
    },
  });

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  function replacePreview(next: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next;
    setPreview(next);
  }

  function rememberFile(next: File | null) {
    setFile(next);
    replacePreview(next ? URL.createObjectURL(next) : null);
  }

  async function onSubmit(values: PatientFormValues) {
    setServerError(null);
    if (file) {
      const invalid = validatePhoto(file);
      if (invalid) {
        setPhotoError(invalid);
        return;
      }
    }

    setPending(true);
    try {
      const photoUrl = file ? await uploadPatientPhoto(file) : "";
      const result = await createPatient({ ...values, photoUrl });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      if (result.id) router.push(`/pacientes/${result.id}`);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "No se pudo guardar el paciente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      <input type="hidden" {...register("ownerMode")} />
      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="text-base font-medium text-stone-950">Tutor responsable</h2>
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
          <button
            type="button"
            className={modeClass(ownerMode === "new")}
            onClick={() => {
              setOwnerMode("new");
              setValue("ownerMode", "new");
            }}
          >
            Tutor nuevo
          </button>
          <button
            type="button"
            className={modeClass(ownerMode === "existing")}
            disabled={owners.length === 0}
            onClick={() => {
              setOwnerMode("existing");
              setValue("ownerMode", "existing");
            }}
          >
            Tutor existente
          </button>
        </div>
        {owners.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Todavía no hay tutores cargados.</p>
        ) : null}

        {ownerMode === "existing" ? (
          <div className="mt-5">
            <Field label="Tutor" error={errors.ownerId?.message}>
              <select {...register("ownerId")} className={inputClass}>
                <option value="">Elegí un tutor</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.full_name}
                    {owner.dni ? ` · ${owner.dni}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Nombre y apellido" error={errors.fullName?.message}>
              <input {...register("fullName")} autoComplete="name" className={inputClass} />
            </Field>
            <Field label="DNI" hint="Documento del tutor" error={errors.dni?.message}>
              <input {...register("dni")} className={inputClass} />
            </Field>
            <Field label="Teléfono" error={errors.phone?.message}>
              <input {...register("phone")} type="tel" autoComplete="tel" className={inputClass} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input {...register("email")} type="email" autoComplete="email" className={inputClass} />
            </Field>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="text-base font-medium text-stone-950">Paciente</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" error={errors.name?.message}>
            <input {...register("name")} className={inputClass} />
          </Field>
          <Field label="Especie" error={errors.species?.message}>
            <select {...register("species")} className={inputClass}>
              {SPECIES.map((species) => (
                <option key={species} value={species}>
                  {species}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Raza" error={errors.breed?.message}>
            <input {...register("breed")} className={inputClass} />
          </Field>
          <Field label="Sexo" error={errors.sex?.message}>
            <select {...register("sex")} className={inputClass}>
              {SEXES.map((sex) => (
                <option key={sex} value={sex}>
                  {sex}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha de nacimiento" error={errors.birthDate?.message}>
            <input {...register("birthDate")} type="date" className={inputClass} />
          </Field>
          <Field label="Peso (kg)" error={errors.weightKg?.message}>
            <input
              {...register("weightKg")}
              inputMode="decimal"
              placeholder="ej. 12,4"
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Foto" hint="JPG, PNG o WebP. Hasta 4 MB." error={photoError ?? undefined}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={`${inputClass} py-2 file:mr-3 file:rounded-full file:border-0 file:bg-stone-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-stone-700`}
                onChange={(event) => {
                  const next = event.target.files?.[0] ?? null;
                  if (!next) {
                    rememberFile(null);
                    setPhotoError(null);
                    return;
                  }
                  const invalid = validatePhoto(next);
                  if (invalid) {
                    rememberFile(null);
                    setPhotoError(invalid);
                    event.target.value = "";
                    return;
                  }
                  setPhotoError(null);
                  rememberFile(next);
                }}
              />
            </Field>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Vista previa de la foto" className="mt-4 size-20 rounded-full object-cover" />
            ) : null}
          </div>
        </div>
      </section>

      {serverError ? <Alert>{serverError}</Alert> : null}

      <button type="submit" className={primaryButtonClass} disabled={pending}>
        {pending ? "Guardando…" : "Guardar paciente"}
      </button>
    </form>
  );
}

function modeClass(active: boolean) {
  return `h-9 rounded-lg text-sm font-medium transition ${
    active ? "bg-white text-stone-950 shadow-sm" : "text-stone-500 hover:text-stone-800"
  } disabled:cursor-not-allowed disabled:opacity-50`;
}
