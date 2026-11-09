"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { inputClass } from "@/components/ui/form";

export function PatientSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) return;
    setValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (value.trim() === initialQuery.trim()) return;
      const params = new URLSearchParams();
      const next = value.trim();
      if (next) params.set("q", next);
      const qs = params.toString();
      router.replace(qs ? `/pacientes?${qs}` : "/pacientes", { scroll: false });
    }, 300);

    return () => window.clearTimeout(handle);
  }, [initialQuery, router, value]);

  return (
    <form
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        const next = value.trim();
        const params = new URLSearchParams();
        if (next) params.set("q", next);
        const qs = params.toString();
        router.replace(qs ? `/pacientes?${qs}` : "/pacientes", { scroll: false });
      }}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        type="search"
        placeholder="Buscar por mascota, tutor o DNI"
        aria-label="Buscar por mascota, tutor o DNI"
        autoComplete="off"
        className={`${inputClass} pl-10 pr-10`}
      />
      {value ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          aria-label="Limpiar búsqueda"
          onClick={() => {
            setValue("");
            router.replace("/pacientes", { scroll: false });
          }}
        >
          <X className="size-4" />
        </button>
      ) : null}
    </form>
  );
}
