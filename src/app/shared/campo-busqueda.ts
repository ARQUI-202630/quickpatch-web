import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { Icono } from './icono';

/** Quita tildes y mayúsculas para comparar textos como los escribe una persona. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** `true` si la consulta está vacía o aparece en alguno de los campos (sin distinguir tildes ni mayúsculas). */
export function coincide(
  consulta: string,
  ...campos: readonly (string | null | undefined)[]
): boolean {
  const buscada = normalizar(consulta);
  return buscada === '' || campos.some((c) => c != null && normalizar(c).includes(buscada));
}

/**
 * Campo de búsqueda para filtrar listas ya cargadas (SCRUM-437). No llama a la API: el filtro lo aplica quien lo usa
 * con `coincide()`. Uso: `<app-campo-busqueda etiqueta="Buscar tenants" [(valor)]="consulta" />`.
 */
@Component({
  selector: 'app-campo-busqueda',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icono],
  styles: `
    :host {
      display: block;
      width: min(100%, 22rem);
    }

    label {
      position: relative;
      display: block;
      font-weight: var(--qp-peso-normal);
    }

    app-icono {
      position: absolute;
      top: 50%;
      left: var(--qp-espacio-3);
      color: var(--qp-texto-secundario);
      transform: translateY(-50%);
      pointer-events: none;
    }

    input {
      width: 100%;
      padding-left: var(--qp-espacio-10);
    }
  `,
  template: `
    <label>
      <span class="oculto">{{ etiqueta() }}</span>
      <app-icono nombre="buscar" [tamano]="18" />
      <input
        type="search"
        autocomplete="off"
        [placeholder]="placeholder()"
        [value]="valor()"
        (input)="valor.set($any($event.target).value)"
      />
    </label>
  `,
})
export class CampoBusqueda {
  /** Nombre accesible del campo. */
  readonly etiqueta = input.required<string>();
  readonly placeholder = input('Buscar');
  readonly valor = model('');
}
