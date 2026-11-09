"use server";

import { revalidatePath } from "next/cache";

import { isAllowedPhotoUrl } from "@/lib/env";
import { emptyToNull, parseWeight } from "@/lib/format";
import { createClient } from "@/lib/supabase-server";
import type { ActionResult } from "@/lib/types";
import {
  firstIssue,
  medicalRecordSchema,
  patientFormSchema,
  qrRegistrationSchema,
  type MedicalRecordValues,
  type PatientFormValues,
  type QrRegistrationValues,
} from "@/lib/validations";

function makeQrCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "AG-";
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export async function createPatient(
  input: PatientFormValues & { photoUrl: string },
): Promise<ActionResult> {
  const parsed = patientFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const values = parsed.data;
  const photoUrl = input.photoUrl.trim();

  if (photoUrl && !isAllowedPhotoUrl(photoUrl)) {
    return {
      ok: false,
      error: "La foto no pertenece al almacenamiento de este proyecto.",
    };
  }

  const supabase = await createClient();
  let createdOwnerId: string | null = null;
  let ownerId = values.ownerId;

  if (values.ownerMode === "new") {
    const { data: owner, error } = await supabase
      .from("owners")
      .insert({
        full_name: values.fullName.trim(),
        dni: emptyToNull(values.dni),
        phone: emptyToNull(values.phone),
        email: emptyToNull(values.email)?.toLowerCase() ?? null,
      })
      .select("id")
      .single();

    if (error || !owner) {
      console.error(error);
      return { ok: false, error: "No se pudo guardar el tutor." };
    }

    createdOwnerId = owner.id;
    ownerId = owner.id;
  } else {
    const { data: owner, error } = await supabase
      .from("owners")
      .select("id")
      .eq("id", values.ownerId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return { ok: false, error: "No se pudo verificar el tutor." };
    }
    if (!owner) {
      return { ok: false, error: "No encontramos ese tutor." };
    }
  }

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .insert({
      owner_id: ownerId,
      name: values.name.trim(),
      species: values.species,
      breed: emptyToNull(values.breed),
      sex: values.sex,
      birth_date: emptyToNull(values.birthDate),
      weight_kg: parseWeight(values.weightKg),
      photo_url: photoUrl || null,
    })
    .select("id")
    .single();

  if (patientError || !patient) {
    console.error(patientError);
    if (createdOwnerId) {
      await supabase.from("owners").delete().eq("id", createdOwnerId);
    }
    return { ok: false, error: "No se pudo guardar el paciente." };
  }

  revalidatePath("/pacientes");
  return { ok: true, id: patient.id };
}

export async function registerFromQr(
  input: QrRegistrationValues & { photoUrl: string },
): Promise<ActionResult> {
  const parsed = qrRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const values = parsed.data;
  const photoUrl = input.photoUrl.trim();

  if (photoUrl && !isAllowedPhotoUrl(photoUrl)) {
    return {
      ok: false,
      error: "La foto no pertenece al almacenamiento de este proyecto.",
    };
  }

  const supabase = await createClient();
  let qrCode = values.qrCode.trim() || makeQrCode();

  if (values.qrCode.trim()) {
    const { data: taken, error: takenError } = await supabase
      .from("patients")
      .select("id")
      .eq("qr_code", qrCode)
      .maybeSingle();

    if (takenError) {
      console.error(takenError);
      return { ok: false, error: "No se pudo verificar el código QR." };
    }
    if (taken) {
      return {
        ok: false,
        error: "Ese QR ya tiene una mascota registrada. Abrí el perfil o usá otro código.",
      };
    }
  } else {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: clash } = await supabase
        .from("patients")
        .select("id")
        .eq("qr_code", qrCode)
        .maybeSingle();
      if (!clash) break;
      qrCode = makeQrCode();
    }
  }

  const { data: owner, error: ownerError } = await supabase
    .from("owners")
    .insert({
      full_name: values.fullName.trim(),
      dni: emptyToNull(values.dni),
      phone: values.phone.trim(),
      email: emptyToNull(values.email)?.toLowerCase() ?? null,
    })
    .select("id")
    .single();

  if (ownerError || !owner) {
    console.error(ownerError);
    return { ok: false, error: "No se pudo guardar el tutor." };
  }

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .insert({
      owner_id: owner.id,
      name: values.name.trim(),
      species: values.species,
      breed: emptyToNull(values.breed),
      sex: values.sex,
      birth_date: emptyToNull(values.birthDate),
      weight_kg: parseWeight(values.weightKg),
      photo_url: photoUrl || null,
      qr_code: qrCode,
    })
    .select("id, qr_code")
    .single();

  if (patientError || !patient) {
    console.error(patientError);
    await supabase.from("owners").delete().eq("id", owner.id);
    if (/duplicate|unique/i.test(patientError?.message ?? "")) {
      return { ok: false, error: "Ese QR ya está en uso. Probá de nuevo." };
    }
    return { ok: false, error: "No se pudo registrar la mascota." };
  }

  revalidatePath("/pacientes");
  revalidatePath(`/p/${patient.qr_code}`);
  revalidatePath("/registrar");
  return { ok: true, id: patient.id, qrCode: patient.qr_code ?? qrCode };
}

export async function addMedicalRecord(input: MedicalRecordValues): Promise<ActionResult> {
  const parsed = medicalRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const values = parsed.data;
  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("patients")
    .select("id")
    .eq("id", values.patientId)
    .maybeSingle();

  if (existingError) {
    console.error(existingError);
    return { ok: false, error: "No se pudo verificar el paciente." };
  }
  if (!existing) {
    return { ok: false, error: "No encontramos ese paciente." };
  }

  const weight = parseWeight(values.weightKg);
  const { error } = await supabase.from("medical_records").insert({
    patient_id: values.patientId,
    visit_date: new Date(values.visitDate).toISOString(),
    reason: values.reason.trim(),
    diagnosis: emptyToNull(values.diagnosis),
    treatment: emptyToNull(values.treatment),
    weight_kg: weight,
  });

  if (error) {
    console.error(error);
    return { ok: false, error: "No se pudo guardar la entrada clínica." };
  }

  if (weight !== null) {
    const { error: weightError } = await supabase
      .from("patients")
      .update({ weight_kg: weight })
      .eq("id", values.patientId);

    if (weightError) {
      console.error(weightError);
      revalidatePath(`/pacientes/${values.patientId}`);
      revalidatePath("/pacientes");
      return {
        ok: false,
        error: "La entrada se guardó, pero no se pudo actualizar el peso del paciente.",
      };
    }
  }

  revalidatePath(`/pacientes/${values.patientId}`);
  revalidatePath("/pacientes");
  return { ok: true };
}
