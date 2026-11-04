import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Error al cargar los datos de una vista, con la opción de reintentar (SCRUM-622, guía de estados de pantalla). Los
 * errores de una acción siguen en `.alerta`: reintentarlos sería repetir la acción, no recargar la vista.
 */
@Component({
  selector: 'app-error-carga',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: var(--qp-espacio-3);
      align-items: center;
    }

    p {
      flex: 1 1 16rem;
    }
  `,
  template: `
    <p class="alerta" role="alert">{{ mensaje() }}</p>
    <button type="button" class="secundario" (click)="reintentar.emit()">Reintentar</button>
  `,
})
export class ErrorCarga {
  readonly mensaje = input.required<string>();
  readonly reintentar = output<void>();
}
