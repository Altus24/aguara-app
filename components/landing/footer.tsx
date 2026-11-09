import Link from "next/link";

import { Logo } from "@/components/logo";

export function LandingFooter() {
  return (
    <footer className="border-t border-stone-200 bg-aguara-mist">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-6 text-stone-500">
            Identificación inteligente para mascotas. QR, perfil del tutor y ficha médica en un
            solo enlace.
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-aguara-ink">Producto</p>
          <ul className="mt-4 space-y-2 text-sm text-stone-600">
            <li>
              <a href="#como-funciona" className="hover:text-aguara-ink">
                Cómo funciona
              </a>
            </li>
            <li>
              <a href="#beneficios" className="hover:text-aguara-ink">
                Beneficios
              </a>
            </li>
            <li>
              <Link href="/mascota/T1-001" className="hover:text-aguara-ink">
                Registrar mascota
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium text-aguara-ink">Acceso</p>
          <ul className="mt-4 space-y-2 text-sm text-stone-600">
            <li>
              <Link href="/admin" className="hover:text-aguara-ink">
                Panel admin
              </Link>
            </li>
            <li>
              <Link href="/mascota/T1-001" className="hover:text-aguara-ink">
                Formulario QR
              </Link>
            </li>
            <li>
              <Link href="/pacientes" className="hover:text-aguara-ink">
                Panel clínico
              </Link>
            </li>
          </ul>
          <div className="mt-6 flex gap-3 text-aguara-orange">
            <a
              href="https://instagram.com"
              aria-label="Instagram"
              className="hover:text-aguara-orange-deep"
            >
              <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
                <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5.2A4.8 4.8 0 1 0 16.8 12 4.8 4.8 0 0 0 12 7.2zm0 7.7A2.9 2.9 0 1 1 14.9 12 2.9 2.9 0 0 1 12 14.9zm5.95-8.55a1.15 1.15 0 1 0 1.15 1.15 1.15 1.15 0 0 0-1.15-1.15z" />
              </svg>
            </a>
            <a
              href="https://facebook.com"
              aria-label="Facebook"
              className="hover:text-aguara-orange-deep"
            >
              <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
                <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v7h3v-7h3.1l.9-3H13v-2c0-.6.4-1 1-1z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-stone-200/80">
        <p className="mx-auto max-w-6xl px-6 py-6 text-sm text-stone-500">© 2026 Aguará App</p>
      </div>
    </footer>
  );
}
