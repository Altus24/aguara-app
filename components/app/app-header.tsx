import Link from "next/link";

import { LogoLink } from "@/components/logo";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-aguara-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
        <LogoLink href="/pacientes" />
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/pacientes" className="font-medium text-aguara-ink">
            Pacientes
          </Link>
          <Link href="/registrar" className="text-stone-500 transition hover:text-aguara-ink">
            Registro QR
          </Link>
          <Link href="/" className="text-stone-500 transition hover:text-aguara-ink">
            Volver al sitio
          </Link>
        </nav>
      </div>
    </header>
  );
}
