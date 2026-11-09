import { connection } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase-server";
import type {
  MedicalRecord,
  OwnerOption,
  OwnerRecord,
  PatientDirectoryRow,
  PatientRecord,
  PublicPetProfile,
} from "@/lib/types";
import { qrCodeSchema } from "@/lib/validations";

function friendlyDbError(message: string) {
  if (
    /patients_directory|schema cache|does not exist|Could not find the table|relation/i.test(
      message,
    )
  ) {
    return "No encontramos las tablas de Aguará. Ejecutá supabase/schema.sql en el SQL Editor de Supabase y recargá esta página.";
  }

  return "No se pudieron leer los datos. Revisá la conexión con Supabase.";
}

export function sanitizeSearch(query: string) {
  return query
    .trim()
    .replace(/[%_,()"\\]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export async function listPatients(query: string) {
  await connection();
  const supabase = await createClient();
  const term = sanitizeSearch(query);

  let request = supabase
    .from("patients_directory")
    .select(
      "id, owner_id, name, species, breed, sex, birth_date, weight_kg, photo_url, qr_code, created_at, owner_name, owner_dni, owner_phone, owner_email",
    )
    .order("name", { ascending: true })
    .limit(200);

  if (term) {
    const pattern = `"%${term.replaceAll('"', "")}%"`;
    request = request.or(
      `name.ilike.${pattern},owner_name.ilike.${pattern},owner_dni.ilike.${pattern}`,
    );
  }

  const { data, error } = await request;

  if (error) {
    console.error(error);
    return { patients: [] as PatientDirectoryRow[], error: friendlyDbError(error.message) };
  }

  return { patients: (data ?? []) as PatientDirectoryRow[], error: null };
}

export async function listOwners() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("owners")
    .select("id, full_name, dni")
    .order("full_name", { ascending: true });

  if (error) {
    console.error(error);
    return { owners: [] as OwnerOption[], error: friendlyDbError(error.message) };
  }

  return { owners: (data ?? []) as OwnerOption[], error: null };
}

function asOwner(value: OwnerRecord | OwnerRecord[] | null): OwnerRecord | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function getPatientFile(id: string) {
  await connection();

  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select(
      "id, owner_id, name, species, breed, sex, birth_date, weight_kg, photo_url, qr_code, created_at, owners(id, full_name, dni, phone, email)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return {
      patient: null as PatientRecord | null,
      records: [] as MedicalRecord[],
      error: friendlyDbError(error.message),
    };
  }

  if (!data) notFound();

  const { owners, ...patient } = data as typeof data & {
    owners: OwnerRecord | OwnerRecord[] | null;
  };

  const { data: records, error: recordsError } = await supabase
    .from("medical_records")
    .select("id, patient_id, visit_date, reason, diagnosis, treatment, weight_kg, created_at")
    .eq("patient_id", id)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (recordsError) {
    console.error(recordsError);
    return {
      patient: null as PatientRecord | null,
      records: [] as MedicalRecord[],
      error: friendlyDbError(recordsError.message),
    };
  }

  return {
    patient: { ...patient, owner: asOwner(owners) } as PatientRecord,
    records: (records ?? []) as MedicalRecord[],
    error: null,
  };
}

export async function getPublicPetByQr(code: string) {
  await connection();

  const parsed = qrCodeSchema.safeParse(code);
  if (!parsed.success) {
    return { pet: null as PublicPetProfile | null, error: null as string | null, invalid: true };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select(
      "id, name, species, breed, sex, birth_date, weight_kg, photo_url, qr_code, owners(full_name, phone, email)",
    )
    .eq("qr_code", parsed.data)
    .maybeSingle();

  if (error) {
    console.error(error);
    return {
      pet: null as PublicPetProfile | null,
      error: friendlyDbError(error.message),
      invalid: false,
    };
  }

  if (!data) {
    return { pet: null as PublicPetProfile | null, error: null, invalid: false };
  }

  const { owners, ...pet } = data as typeof data & {
    owners: OwnerRecord | OwnerRecord[] | null;
  };
  const owner = asOwner(owners);

  return {
    pet: {
      ...pet,
      owner: owner
        ? {
            full_name: owner.full_name,
            phone: owner.phone,
            email: owner.email,
          }
        : null,
    } as PublicPetProfile,
    error: null,
    invalid: false,
  };
}
