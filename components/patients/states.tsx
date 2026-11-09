import Link from "next/link";

import { primaryButtonClass } from "@/components/ui/form";

export function SetupRequired() {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
      <p className="text-sm font-medium text-aguara-orange">Configuración</p>
      <h1 className="mt-2 text-2xl font-medium tracking-tight text-stone-950">
        Falta conectar Supabase
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">
        El panel no usa datos de ejemplo. Para ver pacientes e historias reales:
      </p>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-6 text-stone-700">
        <li>Creá un proyecto en Supabase.</li>
        <li>
          En el SQL Editor, ejecutá el archivo <code className="rounded bg-stone-100 px-1.5 py-0.5">supabase/schema.sql</code> de este repositorio.
        </li>
        <li>
          Copiá <code className="rounded bg-stone-100 px-1.5 py-0.5">.env.local.example</code> a{" "}
          <code className="rounded bg-stone-100 px-1.5 py-0.5">.env.local</code> y completá:
          <span className="mt-2 block rounded bg-stone-100 px-2 py-1 font-mono text-xs">
            NEXT_PUBLIC_SUPABASE_URL
          </span>
          <span className="mt-1 block rounded bg-stone-100 px-2 py-1 font-mono text-xs">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </span>
        </li>
        <li>Reiniciá el servidor de desarrollo.</li>
      </ol>
      <Link href="/" className={`${primaryButtonClass} mt-8`}>
        Volver al sitio
      </Link>
    </section>
  );
}

export function DataError({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-800">
      {message}
    </div>
  );
}
