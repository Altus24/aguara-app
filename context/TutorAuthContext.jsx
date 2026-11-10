"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { supabase } from "@/lib/chapitas/supabaseClient";
import {
  clearTutorSession,
  normalizeTutorEmail,
  readTutorSession,
  writeTutorSession,
} from "@/lib/chapitas/tutorSession";

const TutorAuthContext = createContext(null);

export function TutorAuthProvider({ children }) {
  const [tutor, setTutor] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    setTutor(readTutorSession());
    setAuthLoading(false);
  }, []);

  const signIn = useCallback(async (email, password) => {
    const emailNorm = normalizeTutorEmail(email);
    const passwordNorm = String(password || "").trim().toLowerCase();

    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      throw new Error("Ingresá un email válido.");
    }

    // Temporal: la contraseña es el mismo email.
    if (passwordNorm !== emailNorm) {
      throw new Error("Credenciales incorrectas.");
    }

    const { data, error } = await supabase
      .from("tutores")
      .select("id, nombre_completo, email, telefono, telefono_secundario")
      .eq("email", emailNorm)
      .maybeSingle();

    if (error) {
      if (/tutores|schema cache|does not exist/i.test(error.message)) {
        throw new Error(
          "Falta la tabla de tutores. Ejecutá supabase/chapitas/09_tutores.sql en Supabase.",
        );
      }
      throw new Error("No se pudo iniciar sesión. Intentá de nuevo.");
    }

    if (!data) {
      throw new Error(
        "No encontramos un tutor con ese email. Activá una chapita primero o revisá el correo.",
      );
    }

    writeTutorSession(data);
    setTutor(data);
    return data;
  }, []);

  const signOut = useCallback(() => {
    clearTutorSession();
    setTutor(null);
  }, []);

  return (
    <TutorAuthContext.Provider
      value={{
        tutor,
        isAuthenticated: Boolean(tutor),
        authLoading,
        signIn,
        signOut,
      }}
    >
      {children}
    </TutorAuthContext.Provider>
  );
}

export function useTutorAuth() {
  const context = useContext(TutorAuthContext);
  if (!context) {
    throw new Error("useTutorAuth debe usarse dentro de TutorAuthProvider");
  }
  return context;
}
