"use client";

import { Suspense } from "react";

import AdminLogin from "@/components/chapitas/AdminLogin";

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-aguara-paper text-sm text-stone-500">
          Cargando…
        </div>
      }
    >
      <AdminLogin />
    </Suspense>
  );
}
