import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

let siguienteId = 0;

/**
 * Confirmación de acciones con consecuencias (SCRUM-437): desactivar un tenant, rechazar o suspender un técnico.
 * Usa `<dialog>` nativo en modo modal, que protege el foco y se cierra con Escape. El contenido proyectado explica la
 * consecuencia; el botón principal nombra la acción.
 */
@Component({
  selector: 'app-dialogo-confirmacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    dialog {
      width: min(100% - 2 * var(--qp-espacio-4), 28rem);
      padding: var(--qp-espacio-6);
      border: none;
      border-radius: var(--qp-radio-md);
      background: var(--qp-superficie);
      color: var(--qp-texto);
      box-shadow: var(--qp-sombra-lg);
    }

    dialog[open] {
      animation: aparecer var(--qp-duracion-media) var(--qp-curva-salida);
    }

    dialog::backdrop {
      background: var(--qp-velo);
    }

    h2 {
      font-size: var(--qp-texto-lg);
    }

    .cuerpo {
      color: var(--qp-texto-secundario);
    }

    .acciones {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--qp-espacio-2);
      margin-top: var(--qp-espacio-6);
    }

    @keyframes aparecer {
      from {
        opacity: 0;
        transform: translateY(var(--qp-espacio-2)) scale(0.98);
      }
    }
  `,
  template: `
    <dialog
      #dialogo
      [attr.aria-labelledby]="idTitulo"
      [attr.aria-describedby]="idCuerpo"
      (cancel)="alCancelar($event)"
    >
      <h2 [id]="idTitulo">{{ titulo() }}</h2>
      <div class="cuerpo" [id]="idCuerpo"><ng-content /></div>
      <div class="acciones">
        <button type="button" class="secundario" [disabled]="ocupado()" (click)="cancelar.emit()">
          {{ textoCancelar() }}
        </button>
        <button
          type="button"
          class="confirmar"
          [class.peligro]="peligro()"
          [disabled]="ocupado()"
          [attr.aria-busy]="ocupado()"
          (click)="confirmar.emit()"
        >
          {{ ocupado() ? 'Guardando…' : textoConfirmar() }}
        </button>
      </div>
    </dialog>
  `,
})
export class DialogoConfirmacion {
  readonly abierto = input(false);
  readonly titulo = input.required<string>();
  readonly textoConfirmar = input('Confirmar');
  readonly textoCancelar = input('Cancelar');
  /** Pinta la acción principal en rojo: deshace algo o corta el acceso de alguien. */
  readonly peligro = input(false);
  /** Mientras se guarda, los botones quedan deshabilitados. */
  readonly ocupado = input(false);

  readonly confirmar = output();
  readonly cancelar = output();

  protected readonly idTitulo = `dialogo-${++siguienteId}-titulo`;
  protected readonly idCuerpo = `dialogo-${siguienteId}-cuerpo`;
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const d = this.dialogo().nativeElement;
      if (this.abierto() && !d.open) {
        // jsdom (pruebas) no implementa showModal: basta con el atributo `open`.
        if (typeof d.showModal === 'function') {
          d.showModal();
        } else {
          d.setAttribute('open', '');
        }
      } else if (!this.abierto() && d.open) {
        if (typeof d.close === 'function') {
          d.close();
        } else {
          d.removeAttribute('open');
        }
      }
    });
  }

  /** Escape: el padre decide si cierra (y no se cierra mientras se guarda). */
  protected alCancelar(evento: Event): void {
    evento.preventDefault();
    if (!this.ocupado()) {
      this.cancelar.emit();
    }
  }
}
