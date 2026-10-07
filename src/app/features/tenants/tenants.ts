import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { mensajeDeError } from '../../core/http';
import { EstadoTenant, Tenant, TenantsApi } from './tenants-api';

interface CambioPendiente {
  tenant: Tenant;
  nuevo: EstadoTenant;
}

/**
 * Gestión de tenants (RF-21, SCRUM-41): lista todos los tenants y permite activarlos o desactivarlos con una
 * confirmación. Un tenant inactivo no puede registrar usuarios ni iniciar sesión (RN-T1).
 */
@Component({
  selector: 'app-tenants',
  imports: [DatePipe],
  template: `
    <section class="tarjeta">
      <h2>Tenants</h2>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (cargando()) {
        <p>Cargando…</p>
      } @else {
        <table>
          <caption>
            Empresas oferentes de la plataforma
          </caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">NIT</th>
              <th scope="col">Estado</th>
              <th scope="col">Creado</th>
              <th scope="col"><span class="oculto">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            @for (t of tenants(); track t.id) {
              <tr>
                <td>{{ t.name }}</td>
                <td>{{ t.nit }}</td>
                <td>
                  <span class="estado" [class.inactivo]="t.status === 'inactivo'">{{
                    t.status === 'activo' ? 'Activo' : 'Inactivo'
                  }}</span>
                </td>
                <td>{{ t.createdAt | date: 'dd/MM/yyyy' }}</td>
                <td>
                  @if (pendiente()?.tenant?.id === t.id) {
                    <span class="confirmacion">
                      ¿{{ pendiente()?.nuevo === 'activo' ? 'Activar' : 'Desactivar' }}
                      {{ t.name }}?
                      <button type="button" (click)="confirmar()" [disabled]="guardando()">
                        Confirmar
                      </button>
                      <button type="button" class="secundario" (click)="pendiente.set(null)">
                        Cancelar
                      </button>
                    </span>
                  } @else {
                    <button type="button" class="secundario" (click)="pedirCambio(t)">
                      {{ t.status === 'activo' ? 'Desactivar' : 'Activar' }}
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5">No hay tenants registrados.</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
})
export class Tenants implements OnInit {
  private readonly api = inject(TenantsApi);

  protected readonly tenants = signal<Tenant[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly pendiente = signal<CambioPendiente | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.tenants.set(await firstValueFrom(this.api.listar()));
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  pedirCambio(tenant: Tenant): void {
    this.error.set(null);
    this.pendiente.set({ tenant, nuevo: tenant.status === 'activo' ? 'inactivo' : 'activo' });
  }

  async confirmar(): Promise<void> {
    const cambio = this.pendiente();
    if (!cambio) {
      return;
    }
    this.guardando.set(true);
    try {
      const actualizado = await firstValueFrom(
        this.api.cambiarEstado(cambio.tenant.id, cambio.nuevo),
      );
      this.tenants.update((lista) => lista.map((t) => (t.id === actualizado.id ? actualizado : t)));
      this.pendiente.set(null);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
