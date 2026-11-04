import { Component, computed, inject } from '@angular/core';

import { Sesion } from '../../core/sesion';
import { SolicitudesPlataforma } from './solicitudes-plataforma';
import { SolicitudesTenant } from './solicitudes-tenant';

/**
 * Panel operativo de solicitudes (RF-18, SCRUM-104). El administrador del tenant ve las de su tenant; el de plataforma,
 * solo los conteos de cada tenant (DEP-15).
 */
@Component({
  selector: 'app-solicitudes',
  imports: [SolicitudesPlataforma, SolicitudesTenant],
  template: `
    <div class="pagina">
      <header class="encabezado-pagina">
        <div>
          <h2>Solicitudes</h2>
          <p>
            @if (esPlataforma()) {
              Solicitudes por estado de cada tenant. Solo conteos: no incluye datos de los clientes.
            } @else {
              Solicitudes de servicio de tu empresa por estado. Se actualiza cada minuto.
            }
          </p>
        </div>
      </header>

      @if (esPlataforma()) {
        <app-solicitudes-plataforma />
      } @else {
        <app-solicitudes-tenant />
      }
    </div>
  `,
})
export class Solicitudes {
  private readonly sesion = inject(Sesion);
  protected readonly esPlataforma = computed(() => this.sesion.tieneRol('admin_plataforma'));
}
