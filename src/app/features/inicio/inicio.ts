import { Component, inject } from '@angular/core';

import { Sesion } from '../../core/sesion';

/** Inicio del administrador del tenant. Sus capacidades (técnicos, catálogo, reportes) llegan en próximas historias. */
@Component({
  selector: 'app-inicio',
  template: `
    <section class="tarjeta">
      <h2>Hola, {{ sesion.usuario()?.fullName }}</h2>
      <p>
        Desde aquí administrarás tu empresa en QUICKPATCH: técnicos, catálogo de servicios y
        reportes.
      </p>
      <p class="nota">La gestión de tenants es exclusiva del administrador de la plataforma.</p>
    </section>
  `,
})
export class Inicio {
  protected readonly sesion = inject(Sesion);
}
