"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { crearMascotaSinChapita } from "@/lib/chapitas/mascotasTutor";
import { supabase } from "@/lib/chapitas/supabaseClient";
import { buscarTutorPorContacto, crearTutor, normalizePhoneDigits } from "@/lib/chapitas/tutores";
import {
  clearTutorSession,
  normalizeTutorEmail,
  readTutorSession,
  writeTutorSession,
} from "@/lib/chapitas/tutorSession";

const TutorAuthContext = createContext(null);

const TUTOR_SELECT =
  "id, nombre_completo, email, telefono, telefono_secundario, direccion, clinica_preferida_id";

export function TutorAuthProvider({ children }) {
  const [tutor, setTutor] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const cached = readTutorSession();
      if (!cached?.id) {
        if (!cancelled) {
          setTutor(null);
          setAuthLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("tutores")
          .select(TUTOR_SELECT)
          .eq("id", cached.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          // Red/API: mantener caché; si el tutor no existe, data viene null.
          setTutor(cached);
        } else if (!data) {
          clearTutorSession();
          setTutor(null);
        } else {
          writeTutorSession(data);
          setTutor(data);
        }
      } catch {
        if (cancelled) return;
        setTutor(cached);
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
      .select(TUTOR_SELECT)
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
        "No encontramos un tutor con ese email. Registrate o activá una chapita primero.",
      );
    }

    writeTutorSession(data);
    setTutor(data);
    return data;
  }, []);

  const register = useCallback(async ({ tutor: tutorFields, mascota, foto } = {}) => {
    const emailNorm = normalizeTutorEmail(tutorFields?.email);
    const passwordNorm = String(tutorFields?.password || "").trim().toLowerCase();
    const nombreCompleto = String(tutorFields?.nombreCompleto || "").trim();
    const telefono = String(tutorFields?.telefono || "").trim();
    const telefonoSecundario = String(tutorFields?.telefonoSecundario || "").trim();
    const direccion = String(tutorFields?.direccion || "").trim();

    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      throw new Error("Ingresá un email válido.");
    }
    if (passwordNorm !== emailNorm) {
      throw new Error("Por ahora la contraseña debe ser el mismo email.");
    }
    if (nombreCompleto.length < 2) {
      throw new Error("Ingresá el nombre del tutor.");
    }
    if (normalizePhoneDigits(telefono).length < 8) {
      throw new Error("Ingresá un teléfono válido (mínimo 8 dígitos).");
    }
    if (
      telefonoSecundario &&
      normalizePhoneDigits(telefonoSecundario).length > 0 &&
      normalizePhoneDigits(telefonoSecundario).length < 8
    ) {
      throw new Error("El teléfono secundario debe tener al menos 8 dígitos.");
    }
    if (!mascota) {
      throw new Error("Completá los datos de la mascota.");
    }

    const existing = await buscarTutorPorContacto({ email: emailNorm, telefono });
    if (existing.tutor) {
      throw new Error("Ese email o teléfono ya tiene cuenta. Iniciá sesión.");
    }

    const created = await crearTutor({
      nombreCompleto,
      email: emailNorm,
      telefono,
      telefonoSecundario: telefonoSecundario || null,
      direccion: direccion || null,
    });

    try {
      await crearMascotaSinChapita(created, mascota, { foto: foto || null });
    } catch (err) {
      // Sesión igual: el tutor ya quedó creado; puede completar mascota en el panel.
      writeTutorSession(created);
      setTutor(created);
      throw new Error(
        err instanceof Error
          ? `${err.message} Tu cuenta quedó creada: ingresá y agregá la mascota desde el panel.`
          : "Tu cuenta quedó creada, pero no se pudo guardar la mascota.",
      );
    }

    writeTutorSession(created);
    setTutor(created);
    return created;
  }, []);

  const refreshTutor = useCallback((next) => {
    writeTutorSession(next);
    setTutor(next);
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
        register,
        refreshTutor,
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
