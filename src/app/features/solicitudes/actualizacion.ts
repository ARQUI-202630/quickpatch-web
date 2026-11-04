import { DestroyRef, inject } from '@angular/core';

/** El panel consulta los conteos como máximo una vez por minuto (SCRUM-38, criterio 3; service-request.v1.yaml 1.4.0). */
export const INTERVALO_ACTUALIZACION_MS = 60_000;

/**
 * Llama a `actualizar` cada minuto mientras la pestaña está visible. Al volver a la pestaña actualiza enseguida si ya
 * pasó el minuto. Se detiene al destruir el componente. Debe llamarse en un contexto de inyección.
 */
export function actualizarCadaMinuto(actualizar: () => void): void {
  let ultima = Date.now();
  const ejecutar = () => {
    ultima = Date.now();
    actualizar();
  };
  const oculta = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

  const intervalo = setInterval(() => {
    if (!oculta()) {
      ejecutar();
    }
  }, INTERVALO_ACTUALIZACION_MS);
  const alCambiarVisibilidad = () => {
    if (!oculta() && Date.now() - ultima >= INTERVALO_ACTUALIZACION_MS) {
      ejecutar();
    }
  };
  document.addEventListener('visibilitychange', alCambiarVisibilidad);

  inject(DestroyRef).onDestroy(() => {
    clearInterval(intervalo);
    document.removeEventListener('visibilitychange', alCambiarVisibilidad);
  });
}
