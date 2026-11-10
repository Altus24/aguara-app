"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LogoLink } from "@/components/logo";
import { primaryButtonClass } from "@/components/ui/form";

const NAV_LINKS = [
  { href: "#inicio", label: "Inicio", external: false },
  { href: "#como-funciona", label: "Cómo funciona", external: false },
  { href: "#beneficios", label: "Beneficios", external: false },
  { href: "/tutor/login", label: "Tutores", external: true },
  { href: "/clinica/login", label: "Clínicas", external: true },
  { href: "/admin", label: "Admin", external: true },
] as const;

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-aguara-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <LogoLink />

        <nav className="hidden items-center gap-8 text-sm text-stone-600 md:flex">
          {NAV_LINKS.map((item) =>
            item.external ? (
              <Link
                key={item.href}
                href={item.href}
                className="transition hover:text-aguara-ink"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.href}
                href={item.href}
                className="transition hover:text-aguara-ink"
              >
                {item.label}
              </a>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/mascota/T1-001"
            className={`${primaryButtonClass} h-9 px-3 text-sm sm:px-4`}
          >
            Probar QR
          </Link>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full border border-stone-200 bg-white text-aguara-ink md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="border-t border-stone-200 bg-aguara-paper md:hidden"
        >
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
            {NAV_LINKS.map((item) =>
              item.external ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-3 py-3 text-sm font-medium text-stone-700 hover:bg-aguara-cream/60 hover:text-aguara-ink"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-3 py-3 text-sm font-medium text-stone-700 hover:bg-aguara-cream/60 hover:text-aguara-ink"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ),
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
