"use client";

import { useEffect, useState } from "react";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    Boolean(window.navigator.standalone)
  );
}

export default function PwaProvider() {
  const [deferred, setDeferred] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silencioso: en dev o sin HTTPS el SW puede fallar.
    });

    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferred(event);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    try {
      const hide = sessionStorage.getItem("aguara-pwa-hint-dismissed") === "1";
      setDismissed(hide);
      if (!hide && isIos() && !isStandalone()) {
        setShowIosHint(true);
      }
    } catch {
      if (isIos() && !isStandalone()) setShowIosHint(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    setDismissed(true);
    setShowIosHint(false);
    setDeferred(null);
    try {
      sessionStorage.setItem("aguara-pwa-hint-dismissed", "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } finally {
      setDeferred(null);
      dismiss();
    }
  }

  if (dismissed || isStandalone()) return null;

  if (deferred) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4">
        <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-aguara-orange/25 bg-white/95 p-3 shadow-lg backdrop-blur">
          <img
            src="/icons/icon-192x192.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-aguara-ink">Instalar Aguará</p>
            <p className="text-xs text-stone-500">Agregala a tu pantalla de inicio</p>
          </div>
          <button
            type="button"
            onClick={install}
            className="rounded-xl bg-aguara-orange px-3 py-2 text-sm font-semibold text-white"
          >
            Instalar
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl px-2 py-2 text-sm text-stone-500"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  if (showIosHint) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4">
        <div className="mx-auto max-w-lg rounded-2xl border border-aguara-orange/25 bg-white/95 p-4 shadow-lg backdrop-blur">
          <div className="flex items-start gap-3">
            <img
              src="/icons/apple-touch-icon.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-aguara-ink">Instalar en iPhone</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">
                En Safari tocá <strong>Compartir</strong> y después{" "}
                <strong>Agregar a inicio</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-xl px-2 py-1 text-sm text-stone-500"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
