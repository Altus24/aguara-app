import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/app/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Aguará App — Identificación inteligente para tu mascota",
    template: "%s · Aguará App",
  },
  description:
    "QR en el collar, perfil del tutor y ficha médica digital. Registrá mascota y dueño en segundos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col bg-aguara-paper font-sans text-aguara-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
