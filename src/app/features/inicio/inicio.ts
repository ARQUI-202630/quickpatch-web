import { Component, computed, inject } from '@angular/core';

import { Sesion } from '../../core/sesion';

interface Capacidad {
  titulo: string;
  detalle: string;
}

/** Capacidades del administrador del tenant que llegan en próximas historias; no hay datos inventados. */
const CAPACIDADES: readonly Capacidad[] = [
  {
    titulo: 'Técnicos',
    detalle: 'Aprobar o rechazar el registro de técnicos y proveedores, y suspender cuentas.',
  },
  {
    titulo: 'Catálogo de servicios',
    detalle: 'Categorías y servicios que ofrece tu empresa.',
  },
  {
    titulo: 'Reportes',
    detalle: 'Reportes de la operación de tu empresa.',
  },
];

/** Inicio del administrador del tenant. Sus capacidades (técnicos, catálogo, reportes) llegan en próximas historias. */
@Component({
  selector: 'app-inicio',
  styles: `
    .capacidades {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--qp-espacio-1) var(--qp-espacio-4);
      align-items: center;
      padding: var(--qp-espacio-4) 0;
      border-bottom: 1px solid var(--qp-borde);

      &:first-child {
        padding-top: 0;
      }

      &:last-child {
        padding-bottom: 0;
        border-bottom: none;
      }
    }

    h3 {
      margin: 0;
      font-size: var(--qp-texto-md);
    }

    p {
      grid-column: 1;
      margin: 0;
      color: var(--qp-texto-secundario);
      font-size: var(--qp-texto-sm);
    }

    .estado {
      grid-row: 1 / span 2;
      grid-column: 2;
      background: var(--qp-info-fondo);
      color: var(--qp-info);
    }
  `,
  template: `
    <div class="pagina">
      <header class="encabezado-pagina">
        <div>
          <h2>Hola, {{ nombre() }}</h2>
          <p>Desde aquí administrarás tu empresa en QUICKPATCH.</p>
        </div>
      </header>

      <section class="tarjeta" aria-labelledby="titulo-capacidades">
        <h3 id="titulo-capacidades" class="oculto">Próximas capacidades</h3>
        <ul class="capacidades">
          @for (c of capacidades; track c.titulo) {
            <li>
              <h3>{{ c.titulo }}</h3>
              <p>{{ c.detalle }}</p>
              <span class="estado">Próximamente</span>
            </li>
          }
        </ul>
      </section>

      <p class="nota">La gestión de tenants es exclusiva del administrador de la plataforma.</p>
    </div>
  `,
})
export class Inicio {
  protected readonly sesion = inject(Sesion);
  protected readonly capacidades = CAPACIDADES;
  protected readonly nombre = computed(() => this.sesion.usuario()?.fullName ?? '');
}
