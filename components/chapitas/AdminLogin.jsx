'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

function AdminLogin() {
  const { signIn, isAdmin, user, authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = searchParams.get('from') || '/admin';

  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      router.replace(redirectTo);
    }
  }, [authLoading, user, isAdmin, router, redirectTo]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await signIn(email.trim(), password);
      router.replace(redirectTo);
    } catch {
      setError('Credenciales incorrectas o usuario sin permisos de superadmin.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!authLoading && user && isAdmin) {
    return (
      <section className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-gray-600">Redirigiendo al panel...</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-xl font-semibold text-blue-800 text-center mb-2">Acceso superadmin</h1>
      <p className="text-gray-600 text-center mb-8">
        Ingresá para generar chapitas QR y gestionar mascotas.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-white p-6 shadow-md">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <p className="mt-6 text-center">
        <Link href="/" className="text-blue-600 underline">
          Volver al inicio
        </Link>
      </p>
    </section>
  );
}

export default AdminLogin;
