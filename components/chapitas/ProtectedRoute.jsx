'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function ProtectedRoute({ children, requireAdmin = true }) {
  const { user, isAdmin, authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/admin/login?from=${encodeURIComponent(pathname || '/admin')}`);
    }
  }, [authLoading, user, router, pathname]);

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-blue-600">Cargando...</p>
      </div>
    );
  }

  if (!user) return null;

  if (requireAdmin && !isAdmin) {
    return (
      <section className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold text-blue-800">Acceso restringido</h1>
        <p className="text-gray-600">
          Tu usuario no tiene permisos de superadmin.
        </p>
      </section>
    );
  }

  return children;
}
