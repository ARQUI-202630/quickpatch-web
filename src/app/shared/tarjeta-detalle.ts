import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface DatoDetalle {
  etiqueta: string;
  valor: string | null | undefined;
}

/**
 * Tarjeta de detalle de una entidad (SCRUM-437), pensada para el técnico o proveedor en SCRUM-39 y SCRUM-40. Los datos
 * vacíos se muestran como «—». Proyecta el estado con `[estado]` y los botones con `[acciones]`.
 */
@Component({
  selector: 'app-tarjeta-detalle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--qp-espacio-3);
      margin-bottom: var(--qp-espacio-5);
    }

    h3 {
      margin: 0;
    }

    header p {
      margin: var(--qp-espacio-1) 0 0;
      color: var(--qp-texto-secundario);
      font-size: var(--qp-texto-sm);
    }

    dl {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: var(--qp-espacio-4) var(--qp-espacio-6);
      margin: 0;
    }

    dt {
      color: var(--qp-texto-secundario);
      font-size: var(--qp-texto-xs);
      font-weight: var(--qp-peso-semibold);
    }

    dd {
      margin: var(--qp-espacio-1) 0 0;
      overflow-wrap: anywhere;
    }

    footer:not(:empty) {
      display: flex;
      flex-wrap: wrap;
      gap: var(--qp-espacio-2);
      margin-top: var(--qp-espacio-6);
      padding-top: var(--qp-espacio-4);
      border-top: 1px solid var(--qp-borde);
    }
  `,
  template: `
    <article class="tarjeta">
      <header>
        <div>
          <h3>{{ titulo() }}</h3>
          @if (subtitulo()) {
            <p>{{ subtitulo() }}</p>
          }
        </div>
        <ng-content select="[estado]" />
      </header>
      <dl>
        @for (dato of datos(); track dato.etiqueta) {
          <div>
            <dt>{{ dato.etiqueta }}</dt>
            <dd>{{ dato.valor || '—' }}</dd>
          </div>
        }
      </dl>
      <footer><ng-content select="[acciones]" /></footer>
    </article>
  `,
})
export class TarjetaDetalle {
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string | null>(null);
  readonly datos = input<readonly DatoDetalle[]>([]);
}
