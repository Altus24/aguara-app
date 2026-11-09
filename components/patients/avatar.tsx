"use client";

import { useState } from "react";

import { initials } from "@/lib/format";

export function Avatar({
  name,
  photoUrl,
  size = "md",
}: {
  name: string;
  photoUrl: string | null;
  size?: "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const dim = size === "lg" ? "size-20 text-xl" : "size-12 text-sm";

  if (!photoUrl || failed) {
    return (
      <span
        className={`${dim} grid shrink-0 place-items-center rounded-full bg-aguara-cream font-medium text-aguara-orange`}
        aria-hidden="true"
      >
        {initials(name)}
      </span>
    );
  }

  return (
    // La URL viene de Supabase Storage y el host del proyecto no se conoce al compilar.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt={`Foto de ${name}`}
      onError={() => setFailed(true)}
      className={`${dim} shrink-0 rounded-full object-cover`}
    />
  );
}
