import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type Tono = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro';

/**
 * Insignia de estado (SCRUM-437). El color acompaña al texto, nunca lo reemplaza: el contenido proyectado siempre
 * nombra el estado. Uso: `<app-insignia tono="exito">Activo</app-insignia>`.
 */
@Component({
  selector: 'app-insignia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "'insignia ' + tono()" },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      padding: var(--qp-espacio-1) var(--qp-espacio-3);
      border-radius: var(--qp-radio-pildora);
      font-size: var(--qp-texto-xs);
      font-weight: var(--qp-peso-semibold);
      line-height: var(--qp-interlineado-titulo);
      white-space: nowrap;
    }

    :host(.exito) {
      background: var(--qp-exito-fondo);
      color: var(--qp-exito);
    }

    :host(.aviso) {
      background: var(--qp-aviso-fondo);
      color: var(--qp-aviso);
    }

    :host(.peligro) {
      background: var(--qp-peligro-fondo);
      color: var(--qp-peligro);
    }

    :host(.info) {
      background: var(--qp-info-fondo);
      color: var(--qp-info);
    }

    :host(.neutro) {
      background: var(--qp-neutro-100);
      color: var(--qp-texto-secundario);
    }
  `,
  template: `<ng-content />`,
})
export class Insignia {
  readonly tono = input<Tono>('neutro');
}
