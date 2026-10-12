import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
  styleUrl: './tenants.scss',
  template: `
    <div class="pagina">
      <header class="encabezado-pagina">
        <div>
          <h2>Tenants</h2>
          <p>
            Empresas oferentes de la plataforma. Un tenant inactivo no puede registrar usuarios ni
            iniciar sesión.
          </p>
        </div>
        @if (!cargando() && tenants().length > 0) {
          <p class="resumen numerico">
            <span
              ><strong>{{ activos() }}</strong> {{ activos() === 1 ? 'activo' : 'activos' }}</span
            >
            <span
              ><strong>{{ inactivos() }}</strong>
              {{ inactivos() === 1 ? 'inactivo' : 'inactivos' }}</span
            >
          </p>
        }
      </header>

      @if (error()) {
        <p class="alerta" role="alert">{{ error() }}</p>
      }

      <section class="tarjeta contenedor-tabla">
        <table [attr.aria-busy]="cargando()">
          <caption class="oculto">
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
            @if (cargando()) {
              @for (fila of filasEsqueleto; track fila) {
                <tr class="fila-esqueleto" aria-hidden="true">
                  <td><span class="esqueleto ancho-lg"></span></td>
                  <td><span class="esqueleto ancho-md"></span></td>
                  <td><span class="esqueleto ancho-sm"></span></td>
                  <td><span class="esqueleto ancho-md"></span></td>
                  <td></td>
                </tr>
              }
            } @else {
              @for (t of tenants(); track t.id) {
                <tr>
                  <td class="nombre" data-etiqueta="Nombre">{{ t.name }}</td>
                  <td data-etiqueta="NIT">{{ t.nit }}</td>
                  <td data-etiqueta="Estado">
                    <span class="estado" [class.inactivo]="t.status === 'inactivo'">{{
                      t.status === 'activo' ? 'Activo' : 'Inactivo'
                    }}</span>
                  </td>
                  <td data-etiqueta="Creado">
                    <time [attr.datetime]="t.createdAt">{{
                      t.createdAt | date: 'dd/MM/yyyy'
                    }}</time>
                  </td>
                  <td class="acciones">
                    @if (pendiente()?.tenant?.id === t.id) {
                      <span
                        class="confirmacion"
                        role="group"
                        [attr.aria-label]="'Confirmar cambio de ' + t.name"
                      >
                        <span>
                          ¿{{ pendiente()?.nuevo === 'activo' ? 'Activar' : 'Desactivar' }}
                          {{ t.name }}?
                        </span>
                        <button
                          type="button"
                          [class.peligro]="pendiente()?.nuevo === 'inactivo'"
                          (click)="confirmar()"
                          [disabled]="guardando()"
                        >
                          Confirmar
                        </button>
                        <button type="button" class="secundario" (click)="pendiente.set(null)">
                          Cancelar
                        </button>
                      </span>
                    } @else {
                      <button
                        type="button"
                        class="secundario"
                        [class.peligro]="t.status === 'activo'"
                        (click)="pedirCambio(t)"
                      >
                        {{ t.status === 'activo' ? 'Desactivar' : 'Activar' }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">
                    <div class="vacio">
                      <strong>No hay tenants registrados.</strong>
                      <span>Las empresas oferentes aparecerán aquí cuando se registren.</span>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
        @if (cargando()) {
          <p class="oculto" role="status">Cargando tenants…</p>
        }
      </section>
    </div>
  `,
})
export class Tenants implements OnInit {
  private readonly api = inject(TenantsApi);

  protected readonly tenants = signal<Tenant[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly pendiente = signal<CambioPendiente | null>(null);
  protected readonly activos = computed(
    () => this.tenants().filter((t) => t.status === 'activo').length,
  );
  protected readonly inactivos = computed(() => this.tenants().length - this.activos());
  protected readonly filasEsqueleto = [1, 2, 3];

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
