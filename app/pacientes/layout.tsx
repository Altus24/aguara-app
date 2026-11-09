import type { ReactNode } from "react";

import { AppHeader } from "@/components/app/app-header";

export default function PacientesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8">{children}</div>
    </div>
  );
}
