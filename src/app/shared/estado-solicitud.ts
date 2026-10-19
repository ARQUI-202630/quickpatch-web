import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Insignia, Tono } from './insignia';

/** `ServiceRequestStatus` (service-request.v1.yaml, DD 7.4), en el orden del ciclo de vida. */
export const ESTADOS_SOLICITUD = [
  'buscando_tecnico',
  'en_espera',
  'asignado',
  'cotizado',
  'cotizacion_aceptada',
  'en_progreso',
  'completado',
  'pagado',
  'cancelado',
] as const;

export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

/** Estados de una solicitud que sigue en curso (RF-18: «solicitudes activas»). */
export const ESTADOS_ACTIVOS: readonly EstadoSolicitud[] = ESTADOS_SOLICITUD.slice(0, 6);

/** Estados en los que la solicitud ya terminó. */
export const ESTADOS_CERRADOS: readonly EstadoSolicitud[] = ESTADOS_SOLICITUD.slice(6);

export const PRESENTACION_SOLICITUD: Record<EstadoSolicitud, { etiqueta: string; tono: Tono }> = {
  buscando_tecnico: { etiqueta: 'Buscando técnico', tono: 'info' },
  en_espera: { etiqueta: 'En espera', tono: 'aviso' },
  asignado: { etiqueta: 'Asignado', tono: 'info' },
  cotizado: { etiqueta: 'Cotizado', tono: 'info' },
  cotizacion_aceptada: { etiqueta: 'Cotización aceptada', tono: 'info' },
  en_progreso: { etiqueta: 'En progreso', tono: 'info' },
  completado: { etiqueta: 'Completado', tono: 'exito' },
  pagado: { etiqueta: 'Pagado', tono: 'exito' },
  cancelado: { etiqueta: 'Cancelado', tono: 'neutro' },
};

/** Insignia del estado de una solicitud de servicio (SCRUM-104). */
@Component({
  selector: 'app-estado-solicitud',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Insignia],
  template: `<app-insignia [tono]="presentacion().tono">{{
    presentacion().etiqueta
  }}</app-insignia>`,
})
export class EstadoSolicitudInsignia {
  readonly estado = input.required<EstadoSolicitud>();
  protected readonly presentacion = computed(() => PRESENTACION_SOLICITUD[this.estado()]);
}
