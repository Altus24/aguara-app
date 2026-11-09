import Link from "next/link";

import { LogoLink } from "@/components/logo";
import { primaryButtonClass } from "@/components/ui/form";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-aguara-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <LogoLink />
        <nav className="hidden items-center gap-8 text-sm text-stone-600 md:flex">
          <a href="#inicio" className="transition hover:text-aguara-ink">
            Inicio
          </a>
          <a href="#como-funciona" className="transition hover:text-aguara-ink">
            Cómo funciona
          </a>
          <a href="#beneficios" className="transition hover:text-aguara-ink">
            Beneficios
          </a>
          <Link href="/admin" className="transition hover:text-aguara-ink">
            Admin
          </Link>
        </nav>
        <Link href="/mascota/T1-001" className={`${primaryButtonClass} h-9 px-4`}>
          Probar QR
        </Link>
      </div>
    </header>
  );
}
