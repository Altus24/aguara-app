"use client";

import type { ReactNode } from "react";

import { ChapitasAuthProvider } from "@/context/AuthContext";

export function Providers({ children }: { children: ReactNode }) {
  return <ChapitasAuthProvider>{children}</ChapitasAuthProvider>;
}
