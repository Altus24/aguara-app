"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, Field, inputClass, primaryButtonClass, textAreaClass } from "@/components/ui/form";
import { addMedicalRecord } from "@/lib/actions/patients";
import { medicalRecordSchema, type MedicalRecordValues } from "@/lib/validations";

function localDateTime() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function RecordForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<MedicalRecordValues>({
    resolver: zodResolver(medicalRecordSchema),
    defaultValues: {
      patientId,
      visitDate: "",
      reason: "",
      diagnosis: "",
      treatment: "",
      weightKg: "",
    },
  });

  useEffect(() => {
    setValue("visitDate", localDateTime());
  }, [setValue]);

  async function onSubmit(values: MedicalRecordValues) {
    setServerError(null);
    setSaved(false);
    setPending(true);
    try {
      const result = await addMedicalRecord(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      const nextVisit = localDateTime();
      reset({
        patientId,
        visitDate: nextVisit,
        reason: "",
        diagnosis: "",
        treatment: "",
        weightKg: "",
      });
      setSaved(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const clearSaved = () => setSaved(false);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <input type="hidden" {...register("patientId")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha y hora" error={errors.visitDate?.message}>
          <input
            type="datetime-local"
            className={inputClass}
            {...register("visitDate", { onChange: clearSaved })}
          />
        </Field>
        <Field label="Peso actual (kg)" error={errors.weightKg?.message}>
          <input
            inputMode="decimal"
            placeholder="ej. 12,4"
            className={inputClass}
            {...register("weightKg", { onChange: clearSaved })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Motivo de consulta" error={errors.reason?.message}>
            <input className={inputClass} {...register("reason", { onChange: clearSaved })} />
          </Field>
        </div>
        <Field label="Diagnóstico" error={errors.diagnosis?.message}>
          <textarea className={textAreaClass} {...register("diagnosis", { onChange: clearSaved })} />
        </Field>
        <Field label="Tratamiento" error={errors.treatment?.message}>
          <textarea className={textAreaClass} {...register("treatment", { onChange: clearSaved })} />
        </Field>
      </div>
      {serverError ? <Alert>{serverError}</Alert> : null}
      {saved ? <Alert tone="success">Entrada guardada.</Alert> : null}
      <button type="submit" className={primaryButtonClass} disabled={pending}>
        {pending ? "Guardando…" : "Guardar entrada"}
      </button>
    </form>
  );
}
