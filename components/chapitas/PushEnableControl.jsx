"use client";

import { useEffect, useState } from "react";

import {
  disablePushNotifications,
  enablePushNotifications,
  hasActivePushSubscription,
  iosPushHint,
  notificationPermission,
  pushSupported,
} from "@/lib/chapitas/pushClient";

/**
 * Control minimalista para activar/desactivar Web Push.
 * @param {{ audience: 'tutor'|'clinica', audienceId: string, onEnabledChange?: (enabled: boolean) => void }} props
 */
export default function PushEnableControl({ audience, audienceId, onEnabledChange }) {
  const [status, setStatus] = useState("loading"); // loading | unsupported | blocked | off | on
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!pushSupported()) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      setIosHint(iosPushHint());
      const perm = notificationPermission();
      if (perm === "denied") {
        if (!cancelled) setStatus("blocked");
        return;
      }
      const active = await hasActivePushSubscription();
      if (!cancelled) setStatus(active && perm === "granted" ? "on" : "off");
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [audienceId]);

  async function handleEnable() {
    setBusy(true);
    setError("");
    try {
      await enablePushNotifications({ audience, audienceId });
      setStatus("on");
      onEnabledChange?.(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo activar.";
      setError(msg);
      if (/bloqueado/i.test(msg)) setStatus("blocked");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setError("");
    try {
      await disablePushNotifications();
      setStatus("off");
      onEnabledChange?.(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desactivar.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return <p className="text-xs text-stone-400">…</p>;
  }

  if (status === "unsupported") {
    return (
      <p className="max-w-[14rem] text-right text-xs text-stone-400">
        Push no disponible en este navegador
      </p>
    );
  }

  if (status === "blocked") {
    return (
      <p className="max-w-[14rem] text-right text-xs text-stone-500">
        Notificaciones bloqueadas en el navegador
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      {status === "on" ? (
        <button
          type="button"
          disabled={busy}
          onClick={handleDisable}
          className="text-sm text-stone-500 underline-offset-2 transition hover:text-aguara-ink hover:underline disabled:opacity-60"
        >
          {busy ? "…" : "Desactivar notificaciones"}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy || !audienceId}
          onClick={handleEnable}
          className="text-sm font-medium text-aguara-orange underline-offset-2 transition hover:underline disabled:opacity-60"
        >
          {busy ? "Activando…" : "Activar notificaciones"}
        </button>
      )}
      {iosHint ? (
        <p className="max-w-[16rem] text-right text-[11px] leading-snug text-stone-400">
          En iPhone: instalá Aguará en Inicio para recibir avisos con la app cerrada.
        </p>
      ) : null}
      {error ? (
        <p className="max-w-[16rem] text-right text-[11px] text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
