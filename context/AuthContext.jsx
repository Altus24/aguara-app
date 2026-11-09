'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/chapitas/supabaseClient';

const AuthContext = createContext(null);

export function ChapitasAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const refreshAdminStatus = useCallback(async (currentSession) => {
    if (!currentSession?.user) {
      setIsAdmin(false);
      return;
    }
    const { data, error } = await supabase.rpc('check_is_superadmin');
    setIsAdmin(!error && data === true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      refreshAdminStatus(data.session).finally(() => setAuthLoading(false));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      refreshAdminStatus(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [refreshAdminStatus]);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const { data: isAdminFlag, error: adminError } = await supabase.rpc('check_is_superadmin');
    const adminOk = !adminError && isAdminFlag === true;
    setIsAdmin(adminOk);

    if (!adminOk) {
      await supabase.auth.signOut();
      throw new Error('NOT_ADMIN');
    }

    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isAdmin,
        authLoading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Alias por compatibilidad */
export const AuthProvider = ChapitasAuthProvider;

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de ChapitasAuthProvider');
  }
  return context;
}
