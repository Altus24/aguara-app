import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LogoLink } from "@/components/logo";
import { PublicProfile } from "@/components/qr/public-profile";
import { RegisterForm } from "@/components/qr/register-form";
import { DetailSkeleton } from "@/components/patients/skeletons";
import { DataError, SetupRequired } from "@/components/patients/states";
import { getPublicPetByQr } from "@/lib/data/patients";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Perfil QR",
};

async function QrRoute({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { pet, error, invalid } = await getPublicPetByQr(code);

  if (invalid) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-aguara-ink">Código inválido</h1>
        <p className="mt-2 text-sm text-stone-600">
          El tag no tiene un formato reconocido. Revisá el QR o abrí el formulario general.
        </p>
        <Link href="/registrar" className="mt-5 inline-block text-sm font-medium text-aguara-orange">
          Ir a registrar
        </Link>
      </section>
    );
  }

  if (error) return <DataError message={error} />;

  if (pet) {
    return <PublicProfile pet={pet} />;
  }

  return (
    <div>
      <p className="text-sm font-medium text-aguara-orange">QR sin registrar</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-aguara-ink">
        Formulario en blanco
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
        Este tag todavía no tiene mascota. Completá dueño y paciente para activarlo.
      </p>
      <div className="mt-8">
        <RegisterForm initialCode={code} lockedCode />
      </div>
    </div>
  );
}

export default function PublicQrPage({ params }: { params: Promise<{ code: string }> }) {
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
        {!isSupabaseConfigured() ? (
          <SetupRequired />
        ) : (
          <Suspense fallback={<DetailSkeleton />}>
            <QrRoute params={params} />
          </Suspense>
        )}
      </main>
    </div>
  );
}
