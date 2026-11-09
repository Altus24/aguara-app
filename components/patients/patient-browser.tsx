import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Avatar } from "@/components/patients/avatar";
import { DataError } from "@/components/patients/states";
import { PatientSearch } from "@/components/patients/patient-search";
import { listPatients } from "@/lib/data/patients";
import { formatAge, formatWeight } from "@/lib/format";

export async function PatientBrowser({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? (params.q[0] ?? "") : (params.q ?? "");
  const { patients, error } = await listPatients(rawQuery);
  const query = rawQuery.trim();

  return (
    <div className="space-y-4">
      <PatientSearch initialQuery={query} />
      {error ? <DataError message={error} /> : null}
      {!error && patients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-stone-600">
            {query
              ? `No hay resultados para “${query}”.`
              : "Todavía no hay pacientes en la clínica."}
          </p>
          {query ? (
            <Link href="/pacientes" className="mt-4 inline-block text-sm font-medium text-aguara-orange">
              Ver todos
            </Link>
          ) : (
            <Link href="/pacientes/nuevo" className="mt-4 inline-block text-sm font-medium text-aguara-orange">
              Cargar el primero
            </Link>
          )}
        </div>
      ) : null}
      {!error && patients.length > 0 ? (
        <div>
          <p className="mb-3 text-sm text-stone-500">
            {patients.length === 1 ? "1 paciente" : `${patients.length} pacientes`}
          </p>
          <ul className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {patients.map((patient) => (
              <li key={patient.id} className="border-b border-stone-100 last:border-b-0">
                <Link
                  href={`/pacientes/${patient.id}`}
                  className="flex items-center gap-4 px-4 py-4 transition hover:bg-stone-50 sm:px-5"
                >
                  <Avatar name={patient.name} photoUrl={patient.photo_url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-medium text-stone-950">{patient.name}</p>
                      <p className="shrink-0 text-sm text-stone-500">{patient.species}</p>
                    </div>
                    <p className="mt-1 truncate text-sm text-stone-500">
                      {patient.breed || "Sin raza"} · {formatAge(patient.birth_date)} ·{" "}
                      {formatWeight(patient.weight_kg)}
                    </p>
                    <p className="mt-1 truncate text-sm text-stone-500">
                      Tutor: {patient.owner_name}
                      {patient.owner_dni ? ` · DNI ${patient.owner_dni}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-stone-300" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
