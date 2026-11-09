import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LogoLink } from "@/components/logo";
import { RegisterForm } from "@/components/qr/register-form";
import { FormSkeleton } from "@/components/patients/skeletons";
import { SetupRequired } from "@/components/patients/states";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Registrar mascota",
  description: "Formulario en blanco del QR para registrar mascota y dueño en Aguará App.",
};

async function RegisterContent({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.code) ? (params.code[0] ?? "") : (params.code ?? "");
  const code = raw.trim();

  return (
    <RegisterForm initialCode={code} lockedCode={Boolean(code)} />
  );
}

export default function RegistrarPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-stone-200/80 bg-aguara-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-8">
          <LogoLink />
          <Link href="/" className="text-sm text-stone-500 hover:text-aguara-ink">
            Volver al sitio
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        <p className="text-sm font-medium text-aguara-orange">Registro por QR</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-aguara-ink">
          Formulario en blanco
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
          Completá dueño y mascota. Los datos se guardan en Supabase y el mismo QR abre el perfil
          público.
        </p>

        <div className="mt-8">
          {!isSupabaseConfigured() ? (
            <SetupRequired />
          ) : (
            <Suspense fallback={<FormSkeleton />}>
              <RegisterContent searchParams={searchParams} />
            </Suspense>
          )}
        </div>
      </main>
    </div>
  );
}
