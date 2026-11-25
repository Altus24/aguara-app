"use client";

import { useMemo, useState } from "react";

import {
  ENTREGAS,
  PAGOS,
  TALLES,
  calcularTotales,
  formatArs,
} from "@/lib/ecommerce/catalog";
import { primaryButtonClass } from "@/components/ui/form";

function OptionCard({ selected, onSelect, title, description, children }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full flex-col rounded-2xl border px-4 py-4 text-left transition ${
        selected
          ? "border-aguara-orange bg-aguara-cream/40 shadow-[0_8px_24px_-16px_rgba(243,112,33,0.9)] ring-1 ring-aguara-orange/30"
          : "border-stone-200 bg-white hover:border-stone-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-aguara-ink">{title}</p>
          <p className="mt-1 text-sm leading-6 text-stone-500">{description}</p>
        </div>
        <span
          className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border ${
            selected
              ? "border-aguara-orange bg-aguara-orange text-white"
              : "border-stone-300 bg-white text-transparent"
          }`}
          aria-hidden
        >
          {selected ? (
            <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
              <path d="M7.7 13.3 4.4 10l-1.4 1.4 4.7 4.7 9-9-1.4-1.4z" />
            </svg>
          ) : null}
        </span>
      </div>
      {children}
    </button>
  );
}

function StepTitle({ n, children }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-full bg-aguara-ink text-xs font-semibold text-white">
        {n}
      </span>
      <h2 className="text-base font-semibold text-aguara-ink">{children}</h2>
    </div>
  );
}

function PagoIcon({ id }) {
  if (id === "bank") {
    return (
      <svg viewBox="0 0 24 24" className="size-6 text-aguara-orange" aria-hidden>
        <path
          fill="currentColor"
          d="M12 3 2 8v2h20V8L12 3zm-7 8v6H3v2h18v-2h-2v-6h-2v6h-3v-6h-2v6H7v-6H5z"
        />
      </svg>
    );
  }
  if (id === "cuotas") {
    return (
      <svg viewBox="0 0 24 24" className="size-6 text-aguara-orange" aria-hidden>
        <path
          fill="currentColor"
          d="M12 6V3L8 7l4 4V8c2.8 0 5 2.2 5 5a5 5 0 0 1-8.9 3.1L6.7 17.5A7 7 0 0 0 19 13c0-3.9-3.1-7-7-7zm-5 5c0-1.1.3-2.1.8-3L6.4 6.6A7 7 0 0 0 5 11c0 3.9 3.1 7 7 7v3l4-4-4-4v3c-2.8 0-5-2.2-5-5z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="size-6 text-aguara-orange" aria-hidden>
      <path
        fill="currentColor"
        d="M3 5h8v8H3V5zm2 2v4h4V7H5zm8-2h8v2h-8V5zm0 4h8v2h-8V9zm0 4h8v2h-8v-2zM3 15h8v2H3v-2zm0 4h18v2H3v-2z"
      />
    </svg>
  );
}

/**
 * Flujo de compra: talle → entrega → pago → Mercado Pago.
 */
export default function ComprarFlow({ compact = false }) {
  const [talleId, setTalleId] = useState("S");
  const [entregaId, setEntregaId] = useState("retiro");
  const [pagoId, setPagoId] = useState("qr_debito");
  const [cantidad, setCantidad] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const totales = useMemo(
    () => calcularTotales({ talleId, entregaId, cantidad }),
    [talleId, entregaId, cantidad],
  );

  async function handleContinuar() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ecommerce/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ talleId, entregaId, pagoId, cantidad }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.initPoint) {
        throw new Error(data.error || "No se pudo iniciar el pago.");
      }
      window.location.href = data.initPoint;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el pago.");
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "space-y-8" : "space-y-10"}>
      <div>
        <StepTitle n={1}>Selector de Talle</StepTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          {TALLES.map((t) => (
            <OptionCard
              key={t.id}
              selected={talleId === t.id}
              onSelect={() => setTalleId(t.id)}
              title={t.label}
              description={t.descripcion}
            />
          ))}
        </div>
      </div>

      <div>
        <StepTitle n={2}>Opción de Entrega</StepTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {ENTREGAS.map((e) => (
            <OptionCard
              key={e.id}
              selected={entregaId === e.id}
              onSelect={() => setEntregaId(e.id)}
              title={e.label}
              description={e.descripcion}
            />
          ))}
        </div>
      </div>

      <div>
        <StepTitle n={3}>Métodos de Pago</StepTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          {PAGOS.map((p) => (
            <OptionCard
              key={p.id}
              selected={pagoId === p.id}
              onSelect={() => setPagoId(p.id)}
              title={p.label}
              description={p.descripcion}
            >
              <div className="mt-3">
                <PagoIcon id={p.icon} />
              </div>
            </OptionCard>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-stone-200 bg-white px-4 py-4">
        <label className="text-sm text-stone-600">
          Cantidad
          <input
            type="number"
            min={1}
            max={20}
            className="mt-1 block h-10 w-24 rounded-xl border border-stone-200 px-3 text-sm text-aguara-ink outline-none focus:border-aguara-orange focus:ring-4 focus:ring-aguara-orange/15"
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value) || 1)}
          />
        </label>
        <div className="text-right text-sm text-stone-600">
          <p>
            Identificador{totales.cantidad > 1 ? ` × ${totales.cantidad}` : ""}:{" "}
            <span className="font-medium text-aguara-ink">{formatArs(totales.subtotal)}</span>
          </p>
          <p>
            Envío:{" "}
            <span className="font-medium text-aguara-ink">
              {totales.envio === 0 ? "Gratis" : formatArs(totales.envio)}
            </span>
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        className={`${primaryButtonClass} h-12 w-full text-base uppercase tracking-wide`}
        disabled={busy}
        onClick={handleContinuar}
      >
        {busy ? "Redirigiendo a Mercado Pago…" : "Continuar compra"}
      </button>
      <p className="-mt-6 text-center text-sm font-medium text-stone-600">
        Total: {formatArs(totales.total)}
      </p>
    </div>
  );
}
