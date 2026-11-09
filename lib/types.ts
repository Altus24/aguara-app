export type OwnerOption = {
  id: string;
  full_name: string;
  dni: string | null;
};

export type PatientDirectoryRow = {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  birth_date: string | null;
  weight_kg: number | string | null;
  photo_url: string | null;
  qr_code: string | null;
  created_at: string;
  owner_name: string;
  owner_dni: string | null;
  owner_phone: string | null;
  owner_email: string | null;
};

export type OwnerRecord = {
  id: string;
  full_name: string;
  dni: string | null;
  phone: string | null;
  email: string | null;
};

export type PatientRecord = {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  birth_date: string | null;
  weight_kg: number | string | null;
  photo_url: string | null;
  qr_code: string | null;
  created_at: string;
  owner: OwnerRecord | null;
};

export type PublicPetProfile = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  birth_date: string | null;
  weight_kg: number | string | null;
  photo_url: string | null;
  qr_code: string | null;
  owner: Pick<OwnerRecord, "full_name" | "phone" | "email"> | null;
};

export type MedicalRecord = {
  id: string;
  patient_id: string;
  visit_date: string;
  reason: string;
  diagnosis: string | null;
  treatment: string | null;
  weight_kg: number | string | null;
  created_at: string;
};

export type ActionResult =
  | { ok: true; id?: string; qrCode?: string }
  | { ok: false; error: string };
