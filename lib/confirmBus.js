let pending = null;
const listeners = new Set();

export function subscribeConfirm(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(state) {
  listeners.forEach((listener) => listener(state));
}

/**
 * Abre el modal de confirmación de la app (más fiable que window.confirm).
 * @returns {Promise<boolean>}
 */
export function requestConfirm({ title, message, confirmLabel, cancelLabel, danger }) {
  if (typeof window === 'undefined') return Promise.resolve(false);

  // Si no hay UI montada, cae a window.confirm
  if (listeners.size === 0) {
    return Promise.resolve(window.confirm(message || title || '¿Confirmar?'));
  }

  return new Promise((resolve) => {
    if (pending) {
      pending.resolve(false);
    }
    pending = { resolve };
    emit({
      open: true,
      title: title || 'Confirmar',
      message: message || '¿Confirmar esta acción?',
      confirmLabel: confirmLabel || 'Confirmar',
      cancelLabel: cancelLabel || 'Cancelar',
      danger: Boolean(danger),
    });
  });
}

export function answerConfirm(value) {
  if (pending) {
    pending.resolve(Boolean(value));
    pending = null;
  }
  emit(null);
}
