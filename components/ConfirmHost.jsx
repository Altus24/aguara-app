'use client';

import { useEffect, useState } from 'react';
import { answerConfirm, subscribeConfirm } from '@/lib/confirmBus';

export default function ConfirmHost() {
  const [state, setState] = useState(null);

  useEffect(() => subscribeConfirm(setState), []);

  useEffect(() => {
    if (!state?.open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') answerConfirm(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state?.open]);

  if (!state?.open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-host-title"
      onClick={() => answerConfirm(false)}
      onKeyDown={(event) => {
        // Evita que Enter/Espacio dispare submits de formularios detrás del modal.
        if (event.key === "Enter" || event.key === " ") {
          event.stopPropagation();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <h2 id="confirm-host-title" className="text-lg font-semibold text-stone-900">
          {state.title}
        </h2>
        <p className="mt-2 text-sm text-stone-600 whitespace-pre-wrap">{state.message}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
            onClick={() => answerConfirm(false)}
          >
            {state.cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              state.danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-700 hover:bg-blue-800'
            }`}
            onClick={() => answerConfirm(true)}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
