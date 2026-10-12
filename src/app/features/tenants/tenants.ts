import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { mensajeDeError } from '../../core/http';
import { CampoBusqueda, coincide } from '../../shared/campo-busqueda';
import { DialogoConfirmacion } from '../../shared/dialogo-confirmacion';
import { Insignia } from '../../shared/insignia';
import { EstadoTenant, Tenant, TenantsApi } from './tenants-api';

interface CambioPendiente {
  tenant: Tenant;
  nuevo: EstadoTenant;
}

/**
 * Gestión de tenants (RF-21, SCRUM-41): lista todos los tenants, los filtra por nombre o NIT sobre la lista ya
 * cargada y permite activarlos o desactivarlos con un diálogo de confirmación. Un tenant inactivo no puede registrar
 * usuarios ni iniciar sesión (RN-T1).
 */
@Component({
  selector: 'app-tenants',
  imports: [DatePipe, CampoBusqueda, DialogoConfirmacion, Insignia],
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

      @if (error() && !pendiente()) {
        <p class="alerta" role="alert">{{ error() }}</p>
      }

      <section class="tarjeta contenedor-tabla">
        @if (!cargando() && tenants().length > 0) {
          <div class="herramientas">
            <app-campo-busqueda
              etiqueta="Buscar tenants por nombre o NIT"
              placeholder="Buscar por nombre o NIT"
              [(valor)]="consulta"
            />
          </div>
        }
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
              @for (t of filtrados(); track t.id) {
                <tr>
                  <td class="nombre" data-etiqueta="Nombre">{{ t.name }}</td>
                  <td data-etiqueta="NIT">{{ t.nit }}</td>
                  <td data-etiqueta="Estado">
                    <app-insignia [tono]="t.status === 'activo' ? 'exito' : 'peligro'">{{
                      t.status === 'activo' ? 'Activo' : 'Inactivo'
                    }}</app-insignia>
                  </td>
                  <td data-etiqueta="Creado">
                    <time [attr.datetime]="t.createdAt">{{
                      t.createdAt | date: 'dd/MM/yyyy'
                    }}</time>
                  </td>
                  <td class="acciones">
                    <button
                      type="button"
                      class="secundario"
                      [class.peligro]="t.status === 'activo'"
                      (click)="pedirCambio(t)"
                    >
                      {{ t.status === 'activo' ? 'Desactivar' : 'Activar' }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">
                    @if (tenants().length === 0) {
                      <div class="vacio">
                        <strong>No hay tenants registrados.</strong>
                        <span>Las empresas oferentes aparecerán aquí cuando se registren.</span>
                      </div>
                    } @else {
                      <div class="vacio">
                        <strong>Ningún tenant coincide con «{{ consulta() }}».</strong>
                        <button type="button" class="secundario" (click)="consulta.set('')">
                          Limpiar búsqueda
                        </button>
                      </div>
                    }
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

      <app-dialogo-confirmacion
        [abierto]="pendiente() !== null"
        [titulo]="tituloDialogo()"
        [textoConfirmar]="pendiente()?.nuevo === 'activo' ? 'Sí, activar' : 'Sí, desactivar'"
        [peligro]="pendiente()?.nuevo === 'inactivo'"
        [ocupado]="guardando()"
        (confirmar)="confirmar()"
        (cancelar)="cancelarCambio()"
      >
        <p>
          @if (pendiente()?.nuevo === 'inactivo') {
            Sus usuarios no podrán registrarse ni iniciar sesión hasta que lo actives de nuevo.
          } @else {
            Sus usuarios podrán registrarse e iniciar sesión de nuevo.
          }
        </p>
        @if (error() && pendiente()) {
          <p class="alerta" role="alert">{{ error() }}</p>
        }
      </app-dialogo-confirmacion>
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
  protected readonly consulta = signal('');
  protected readonly filtrados = computed(() =>
    this.tenants().filter((t) => coincide(this.consulta(), t.name, t.nit)),
  );
  protected readonly tituloDialogo = computed(() => {
    const cambio = this.pendiente();
    if (!cambio) {
      return '';
    }
    return `¿${cambio.nuevo === 'activo' ? 'Activar' : 'Desactivar'} ${cambio.tenant.name}?`;
  });

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

  cancelarCambio(): void {
    this.pendiente.set(null);
    this.error.set(null);
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
