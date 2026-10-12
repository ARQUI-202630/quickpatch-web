import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Insignia, Tono } from './insignia';

/** `verificationStatus` del técnico o proveedor (identity.v1.yaml 1.1.0). */
export type EstadoVerificacion = 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido';

export const PRESENTACION_VERIFICACION: Record<
  EstadoVerificacion,
  { etiqueta: string; tono: Tono }
> = {
  pendiente: { etiqueta: 'Pendiente', tono: 'aviso' },
  aprobado: { etiqueta: 'Aprobado', tono: 'exito' },
  rechazado: { etiqueta: 'Rechazado', tono: 'peligro' },
  suspendido: { etiqueta: 'Suspendido', tono: 'neutro' },
};

/** Insignia del estado de verificación de un técnico (SCRUM-437, para SCRUM-39 y SCRUM-40). */
@Component({
  selector: 'app-estado-verificacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Insignia],
  template: `<app-insignia [tono]="presentacion().tono">{{
    presentacion().etiqueta
  }}</app-insignia>`,
})
export class EstadoVerificacionInsignia {
  readonly estado = input.required<EstadoVerificacion>();
  protected readonly presentacion = computed(() => PRESENTACION_VERIFICACION[this.estado()]);
}
