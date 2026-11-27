"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  clearClinicSession,
  normalizeClinicEmail,
  readClinicSession,
  writeClinicSession,
} from "@/lib/chapitas/clinicSession";
import {
  crearClinicaConDirectorTecnico,
  obtenerClinica,
  obtenerClinicaPorEmail,
} from "@/lib/chapitas/clinicas";
import { clinicaEstaRechazada } from "@/lib/chapitas/clinicaRegistro";

const ClinicAuthContext = createContext(null);

export function ClinicAuthProvider({ children }) {
  const [clinica, setClinica] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const cached = readClinicSession();
      if (!cached?.id) {
        if (!cancelled) {
          setClinica(null);
          setAuthLoading(false);
        }
        return;
      }

      try {
        const fresh = await obtenerClinica(cached.id);
        if (cancelled) return;
        if (!fresh) {
          clearClinicSession();
          setClinica(null);
        } else {
          writeClinicSession(fresh);
          setClinica(fresh);
        }
      } catch {
        if (cancelled) return;
        // Red/API: mantener caché temporal; si la clínica no existe, obtenerClinica → null.
        setClinica(cached);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
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
    if (clinicaEstaRechazada(data)) {
      throw new Error(
        "Este perfil fue rechazado por Aguará. Contactanos si necesitás reintentar el alta.",
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

    const matricula = String(payload.director_matricula || "").trim();
    if (matricula.length < 2) {
      throw new Error("Solo veterinarios matriculados pueden crear una cuenta. Ingresá la matrícula del director técnico.");
    }

    const data = await crearClinicaConDirectorTecnico({
      clinica: {
        nombre: payload.nombre,
        email: emailNorm,
        telefono: payload.telefono,
        direccion: payload.direccion,
        ciudad: payload.ciudad,
        provincia: payload.provincia,
        descripcion: payload.descripcion,
      },
      director: {
        nombre: payload.director_nombre,
        matricula,
        especialidad: payload.director_especialidad,
        email: payload.director_email || emailNorm,
      },
    });

    writeClinicSession(data);
    setClinica(data);
    return data;
  }, []);

  const refreshClinica = useCallback((next) => {
    if (!next?.id) return;
    writeClinicSession(next);
    setClinica((prev) => ({ ...(prev || {}), ...next }));
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
