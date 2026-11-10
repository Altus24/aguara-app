"use client";

import type { ReactNode } from "react";

import { ChapitasAuthProvider } from "@/context/AuthContext";
import { ClinicAuthProvider } from "@/context/ClinicAuthContext";
import { TutorAuthProvider } from "@/context/TutorAuthContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ChapitasAuthProvider>
      <TutorAuthProvider>
        <ClinicAuthProvider>{children}</ClinicAuthProvider>
      </TutorAuthProvider>
    </ChapitasAuthProvider>
  );
}
