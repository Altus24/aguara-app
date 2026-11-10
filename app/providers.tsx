"use client";

import type { ReactNode } from "react";

import { ChapitasAuthProvider } from "@/context/AuthContext";
import { TutorAuthProvider } from "@/context/TutorAuthContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ChapitasAuthProvider>
      <TutorAuthProvider>{children}</TutorAuthProvider>
    </ChapitasAuthProvider>
  );
}
