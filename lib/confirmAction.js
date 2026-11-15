import { requestConfirm } from './confirmBus';

/**
 * Confirmaciones estándar para guardar / eliminar en toda la app.
 * Usan un modal propio (async). Siempre: `if (!(await confirmEliminar(...))) return;`
 */

export async function confirmEliminar(detalle) {
  const message = detalle
    ? `¿Eliminar ${detalle}? Esta acción no se puede deshacer.`
    : '¿Eliminar este elemento? Esta acción no se puede deshacer.';
  return requestConfirm({
    title: 'Eliminar',
    message,
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
    danger: true,
  });
}

export async function confirmGuardar(detalle) {
  const message = detalle ? `¿Guardar ${detalle}?` : '¿Guardar los cambios?';
  return requestConfirm({
    title: 'Guardar',
    message,
    confirmLabel: 'Guardar',
    cancelLabel: 'Cancelar',
    danger: false,
  });
}

export async function confirmAccion(mensaje) {
  return requestConfirm({
    title: 'Confirmar',
    message: mensaje || '¿Confirmar esta acción?',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    danger: false,
  });
}
