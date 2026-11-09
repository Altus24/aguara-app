import { listOwners } from "@/lib/data/patients";
import { PatientForm } from "@/components/patients/patient-form";
import { DataError } from "@/components/patients/states";

export async function NewPatient() {
  const { owners, error } = await listOwners();
  if (error) return <DataError message={error} />;
  return <PatientForm owners={owners} />;
}
