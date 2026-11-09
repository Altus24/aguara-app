import type { ReactNode } from "react";

export const controlClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-aguara-ink outline-none transition placeholder:text-stone-400 focus:border-aguara-orange focus:ring-4 focus:ring-aguara-orange/15";

export const inputClass = `${controlClass} h-11`;
export const textAreaClass = `${controlClass} min-h-28 py-3`;

export const primaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-aguara-orange px-5 text-sm font-medium text-white shadow-[0_10px_24px_-12px_rgba(243,112,33,0.85)] transition hover:bg-aguara-orange-deep disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-aguara-orange/40 bg-white px-5 text-sm font-medium text-aguara-orange transition hover:border-aguara-orange hover:bg-aguara-cream/40 disabled:cursor-not-allowed disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-aguara-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-sm text-red-700">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-sm text-stone-500">{hint}</span>
      ) : null}
    </label>
  );
}

export function Alert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "success";
}) {
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <p
      role={tone === "success" ? "status" : "alert"}
      className={`rounded-xl border px-3 py-2 text-sm ${className}`}
    >
      {children}
    </p>
  );
}
