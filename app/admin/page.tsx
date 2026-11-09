import { Suspense } from "react";

import AdminDashboard from "@/components/chapitas/AdminDashboard";
import ProtectedRoute from "@/components/chapitas/ProtectedRoute";

function AdminFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-aguara-paper text-sm text-stone-500">
      Cargando panel…
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <ProtectedRoute>
        <AdminDashboard />
      </ProtectedRoute>
    </Suspense>
  );
}
