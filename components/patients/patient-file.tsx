import Link from "next/link";

import { Avatar } from "@/components/patients/avatar";
import { RecordForm } from "@/components/patients/record-form";
import { DataError } from "@/components/patients/states";
import { getPatientFile } from "@/lib/data/patients";
import { formatAge, formatDate, formatVisit, formatWeight } from "@/lib/format";

export async function PatientFile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { patient, records, error } = await getPatientFile(id);

  if (error || !patient) {
    return <DataError message={error ?? "No se pudo abrir la ficha."} />;
  }

  const facts = [
    ["Especie", patient.species],
    ["Raza", patient.breed || "Sin registro"],
    ["Sexo", patient.sex || "Sin registro"],
    ["Edad", formatAge(patient.birth_date)],
    ["Nacimiento", formatDate(patient.birth_date)],
    ["Peso", formatWeight(patient.weight_kg)],
    ["Código QR", patient.qr_code || "Sin asignar"],
  ];

  return (
    <div>
      <Link href="/pacientes" className="text-sm text-stone-500 hover:text-stone-950">
        ← Pacientes
      </Link>

      <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar name={patient.name} photoUrl={patient.photo_url} size="lg" />
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-stone-950">{patient.name}</h1>
            <p className="mt-1 text-sm text-stone-500">
              {patient.species}
              {patient.breed ? ` · ${patient.breed}` : ""}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="bg-white px-4 py-3">
              <dt className="text-xs text-stone-500">{label}</dt>
              <dd className="mt-1 text-sm font-medium text-stone-950">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 border-t border-stone-100 pt-5">
          <h2 className="text-sm font-medium text-stone-950">Tutor responsable</h2>
          {patient.owner ? (
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-stone-500">Nombre</dt>
                <dd className="mt-1 text-stone-950">{patient.owner.full_name}</dd>
              </div>
              <div>
                <dt className="text-stone-500">DNI</dt>
                <dd className="mt-1 text-stone-950">{patient.owner.dni || "Sin registro"}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Teléfono</dt>
                <dd className="mt-1 text-stone-950">{patient.owner.phone || "Sin registro"}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Email</dt>
                <dd className="mt-1 text-stone-950">{patient.owner.email || "Sin registro"}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-stone-500">Sin tutor asociado.</p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="text-base font-medium text-stone-950">Nueva consulta</h2>
        <p className="mt-1 text-sm text-stone-500">
          La entrada queda en el historial, de la más reciente a la más antigua.
        </p>
        <div className="mt-5">
          <RecordForm patientId={patient.id} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-medium text-stone-950">Historial clínico</h2>
        {records.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-8 text-sm text-stone-500">
            Todavía no hay entradas clínicas.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {records.map((record) => (
              <li key={record.id} className="rounded-2xl border border-stone-200 bg-white p-5">
                <time dateTime={record.visit_date} className="text-xs text-stone-500">
                  {formatVisit(record.visit_date)}
                </time>
                <h3 className="mt-2 text-base font-medium text-stone-950">{record.reason}</h3>
                {record.diagnosis ? (
                  <p className="mt-3 text-sm leading-6 text-stone-700">
                    <span className="font-medium text-stone-950">Diagnóstico. </span>
                    {record.diagnosis}
                  </p>
                ) : null}
                {record.treatment ? (
                  <p className="mt-2 text-sm leading-6 text-stone-700">
                    <span className="font-medium text-stone-950">Tratamiento. </span>
                    {record.treatment}
                  </p>
                ) : null}
                {record.weight_kg !== null && record.weight_kg !== undefined ? (
                  <p className="mt-3 text-sm text-stone-500">Peso: {formatWeight(record.weight_kg)}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
