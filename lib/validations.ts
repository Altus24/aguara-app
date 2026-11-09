import { z } from "zod";

export const SPECIES = ["Perro", "Gato", "Ave", "Conejo", "Exótico", "Otro"] as const;
export const SEXES = ["Macho", "Hembra", "Desconocido"] as const;

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validatePhoto(file: File) {
  if (!PHOTO_TYPES.has(file.type)) {
    return "La foto tiene que ser JPG, PNG o WebP.";
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return "La foto no puede superar 4 MB.";
  }
  return null;
}

export function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Revisá los datos ingresados.";
}

function weightIssue(value: string) {
  if (!value.trim()) return null;
  const number = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(number) || number <= 0 || number > 1500) {
    return "Ingresá un peso en kg, mayor a 0 y hasta 1500.";
  }
  return null;
}

function birthDateIssue(value: string) {
  if (!value.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "La fecha de nacimiento no es válida.";
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "La fecha de nacimiento no es válida.";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) return "La fecha de nacimiento no puede ser futura.";
  if (year < 1900) return "Revisá la fecha de nacimiento.";
  return null;
}

export const patientFormSchema = z
  .object({
    ownerMode: z.enum(["new", "existing"]),
    ownerId: z.string(),
    fullName: z.string().trim().max(120, "El nombre del tutor es demasiado largo."),
    dni: z.string().trim().max(32, "El documento es demasiado largo."),
    phone: z.string().trim().max(40, "El teléfono es demasiado largo."),
    email: z.string().trim().max(160, "El email es demasiado largo."),
    name: z
      .string()
      .trim()
      .min(1, "Ingresá el nombre de la mascota.")
      .max(80, "El nombre de la mascota es demasiado largo."),
    species: z.enum(SPECIES, { error: "Elegí una especie." }),
    breed: z.string().trim().max(80, "La raza es demasiado larga."),
    sex: z.enum(SEXES, { error: "Elegí el sexo." }),
    birthDate: z.string(),
    weightKg: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.ownerMode === "existing") {
      if (!z.uuid().safeParse(data.ownerId).success) {
        ctx.addIssue({
          code: "custom",
          path: ["ownerId"],
          message: "Elegí un tutor.",
        });
      }
    } else if (data.fullName.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["fullName"],
        message: "Ingresá el nombre del tutor.",
      });
    }

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "El email no es válido.",
      });
    }

    const birthError = birthDateIssue(data.birthDate);
    if (birthError) {
      ctx.addIssue({ code: "custom", path: ["birthDate"], message: birthError });
    }

    const weightError = weightIssue(data.weightKg);
    if (weightError) {
      ctx.addIssue({ code: "custom", path: ["weightKg"], message: weightError });
    }
  });

export const medicalRecordSchema = z
  .object({
    patientId: z.uuid("No encontramos ese paciente."),
    visitDate: z.string(),
    reason: z
      .string()
      .trim()
      .min(2, "Ingresá el motivo de consulta.")
      .max(500, "El motivo es demasiado largo."),
    diagnosis: z.string().trim().max(2000, "El diagnóstico es demasiado largo."),
    treatment: z.string().trim().max(2000, "El tratamiento es demasiado largo."),
    weightKg: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.visitDate) {
      ctx.addIssue({
        code: "custom",
        path: ["visitDate"],
        message: "Ingresá la fecha de la consulta.",
      });
      return;
    }

    const visit = new Date(data.visitDate);
    if (Number.isNaN(visit.getTime())) {
      ctx.addIssue({
        code: "custom",
        path: ["visitDate"],
        message: "La fecha no es válida.",
      });
    } else if (visit.getTime() > Date.now() + 60_000) {
      ctx.addIssue({
        code: "custom",
        path: ["visitDate"],
        message: "La fecha no puede ser futura.",
      });
    }

    const weightError = weightIssue(data.weightKg);
    if (weightError) {
      ctx.addIssue({ code: "custom", path: ["weightKg"], message: weightError });
    }
  });

export const qrCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{4,64}$/, "El código QR no es válido.");

export const qrRegistrationSchema = z
  .object({
    qrCode: z.string().trim(),
    fullName: z
      .string()
      .trim()
      .min(2, "Ingresá el nombre del tutor.")
      .max(120, "El nombre del tutor es demasiado largo."),
    dni: z.string().trim().max(32, "El documento es demasiado largo."),
    phone: z
      .string()
      .trim()
      .min(6, "Ingresá un teléfono de contacto.")
      .max(40, "El teléfono es demasiado largo."),
    email: z.string().trim().max(160, "El email es demasiado largo."),
    name: z
      .string()
      .trim()
      .min(1, "Ingresá el nombre de la mascota.")
      .max(80, "El nombre de la mascota es demasiado largo."),
    species: z.enum(SPECIES, { error: "Elegí una especie." }),
    breed: z.string().trim().max(80, "La raza es demasiado larga."),
    sex: z.enum(SEXES, { error: "Elegí el sexo." }),
    birthDate: z.string(),
    weightKg: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.qrCode) {
      const code = qrCodeSchema.safeParse(data.qrCode);
      if (!code.success) {
        ctx.addIssue({
          code: "custom",
          path: ["qrCode"],
          message: code.error.issues[0]?.message ?? "El código QR no es válido.",
        });
      }
    }

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "El email no es válido.",
      });
    }

    const birthError = birthDateIssue(data.birthDate);
    if (birthError) {
      ctx.addIssue({ code: "custom", path: ["birthDate"], message: birthError });
    }

    const weightError = weightIssue(data.weightKg);
    if (weightError) {
      ctx.addIssue({ code: "custom", path: ["weightKg"], message: weightError });
    }
  });

export type PatientFormValues = z.infer<typeof patientFormSchema>;
export type MedicalRecordValues = z.infer<typeof medicalRecordSchema>;
export type QrRegistrationValues = z.infer<typeof qrRegistrationSchema>;
