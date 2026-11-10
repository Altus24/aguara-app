"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  clearClinicSession,
  normalizeClinicEmail,
  readClinicSession,
  writeClinicSession,
} from "@/lib/chapitas/clinicSession";
import { crearClinica, obtenerClinicaPorEmail } from "@/lib/chapitas/clinicas";

const ClinicAuthContext = createContext(null);

export function ClinicAuthProvider({ children }) {
  const [clinica, setClinica] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    setClinica(readClinicSession());
    setAuthLoading(false);
  }, []);

  const signIn = useCallback(async (email, password) => {
    const emailNorm = normalizeClinicEmail(email);
    const passwordNorm = String(password || "").trim().toLowerCase();

    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      throw new Error("Ingresá un email válido.");
    }

    // Temporal: la contraseña es el mismo email.
    if (passwordNorm !== emailNorm) {
      throw new Error("Credenciales incorrectas.");
    }

    const data = await obtenerClinicaPorEmail(emailNorm);
    if (!data) {
      throw new Error(
        "No encontramos una clínica con ese email. Registrate primero.",
      );
    }

    writeClinicSession(data);
    setClinica(data);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const emailNorm = normalizeClinicEmail(payload.email);
    const passwordNorm = String(payload.password || "").trim().toLowerCase();

    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      throw new Error("Ingresá un email válido.");
    }
    if (passwordNorm !== emailNorm) {
      throw new Error("Por ahora la contraseña debe ser el mismo email.");
    }

    const data = await crearClinica({
      nombre: payload.nombre,
      email: emailNorm,
      telefono: payload.telefono,
      direccion: payload.direccion,
      ciudad: payload.ciudad,
      provincia: payload.provincia,
      descripcion: payload.descripcion,
    });

    writeClinicSession(data);
    setClinica(data);
    return data;
  }, []);

  const refreshClinica = useCallback((next) => {
    writeClinicSession(next);
    setClinica(next);
  }, []);

  const signOut = useCallback(() => {
    clearClinicSession();
    setClinica(null);
  }, []);

  return (
    <ClinicAuthContext.Provider
      value={{
        clinica,
        isAuthenticated: Boolean(clinica),
        authLoading,
        signIn,
        register,
        refreshClinica,
        signOut,
      }}
    >
      {children}
    </ClinicAuthContext.Provider>
  );
}

export function useClinicAuth() {
  const context = useContext(ClinicAuthContext);
  if (!context) {
    throw new Error("useClinicAuth debe usarse dentro de ClinicAuthProvider");
  }
  return context;
}
