import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { mensajeDeError, tipoDeError } from '../../core/http';
import { ErrorCarga } from '../../shared/error-carga';
import { EnlaceRecuperacion, RecuperacionApi, SolicitudRecuperacion } from './recuperacion-api';

export const TAMANO_PAGINA = 20;

/** Nombre de cada rol que puede pedir la recuperación; los administradores no usan este flujo. */
const ROLES: Record<string, string> = {
  cliente: 'Cliente',
  empresa_contacto: 'Contacto de empresa',
  tecnico: 'Técnico',
  proveedor: 'Proveedor',
};

interface EnlaceGenerado {
  solicitud: SolicitudRecuperacion;
  enlace: EnlaceRecuperacion;
}

/**
 * Solicitudes de recuperación de contraseña del tenant (SCRUM-626, identity 1.10.0); solo `admin_tenant`. El
 * administrador confirma que es el usuario quien la pidió y genera un enlace de un solo uso que vence en 1 hora. El
 * enlace solo se ve en la respuesta: se muestra una vez, con la opción de copiarlo, y generar otro anula el anterior.
 */
@Component({
  selector: 'app-recuperaciones',
  imports: [DatePipe, ErrorCarga],
  styleUrl: '../tecnicos/tecnicos.scss',
  styles: `
    .enlace-generado {
      display: grid;
      gap: var(--qp-espacio-3);
      max-width: none;

      h3 {
        margin: 0;
        font-size: var(--qp-texto-md);
      }

      p {
        margin: 0;
        color: var(--qp-texto-secundario);
        font-size: var(--qp-texto-sm);
      }
    }

    .copiable {
      display: flex;
      flex-wrap: wrap;
      gap: var(--qp-espacio-2);

      input {
        flex: 1 1 18rem;
        min-width: 0;
        font-family: monospace;
      }
    }
  `,
  template: `
    <div class="pagina">
      <header class="encabezado-pagina">
        <div>
          <h2>Recuperar contraseñas</h2>
          <p>
            Usuarios de tu empresa que olvidaron su contraseña. Antes de generar el enlace, confirma
            que es la persona quien lo pidió.
          </p>
        </div>
      </header>

      @if (errorCarga(); as mensaje) {
        <app-error-carga [mensaje]="mensaje" (reintentar)="cargar()" />
      }
      @if (error(); as mensaje) {
        <p class="alerta" role="alert">{{ mensaje }}</p>
      }
      <p class="aviso" role="status">{{ aviso() }}</p>

      @if (generado(); as g) {
        <section class="tarjeta enlace-generado" aria-labelledby="titulo-enlace">
          <h3 id="titulo-enlace">Enlace para {{ g.solicitud.fullName }}</h3>
          <div class="copiable">
            <label for="enlace" class="oculto">Enlace de recuperación</label>
            <input id="enlace" type="text" readonly [value]="g.enlace.link" />
            <button type="button" class="secundario" (click)="copiar(g.enlace.link)">
              Copiar enlace
            </button>
          </div>
          <p>
            Vence el
            <time [attr.datetime]="g.enlace.expiresAt">{{
              g.enlace.expiresAt | date: 'dd/MM/yyyy, HH:mm'
            }}</time
            >. Sirve una sola vez y no se volverá a mostrar: si se pierde, genera otro. Entrégalo
            por el medio que usas con {{ g.solicitud.fullName }}.
          </p>
          <div>
            <button type="button" class="secundario" (click)="cerrarEnlace()">Listo</button>
          </div>
        </section>
      }

      <section class="tarjeta contenedor-tabla">
        <table [attr.aria-busy]="cargando()">
          <caption class="oculto">
            Solicitudes de recuperación pendientes
          </caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Rol</th>
              <th scope="col">Pedida</th>
              <th scope="col"><span class="oculto">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            @if (cargando()) {
              @for (fila of filasEsqueleto; track fila) {
                <tr class="fila-esqueleto" aria-hidden="true">
                  <td><span class="esqueleto ancho-lg"></span></td>
                  <td><span class="esqueleto ancho-sm"></span></td>
                  <td><span class="esqueleto ancho-md"></span></td>
                  <td></td>
                </tr>
              }
            } @else {
              @for (s of solicitudes(); track s.id) {
                <tr>
                  <td data-etiqueta="Nombre">
                    <span class="nombre">{{ s.fullName }}</span>
                    <span class="secundario">{{ s.email }}</span>
                  </td>
                  <td data-etiqueta="Rol">{{ rol(s.role) }}</td>
                  <td data-etiqueta="Pedida">
                    <time [attr.datetime]="s.requestedAt">{{
                      s.requestedAt | date: 'dd/MM/yyyy, HH:mm'
                    }}</time>
                  </td>
                  <td class="acciones">
                    <div class="botones">
                      <button
                        type="button"
                        class="secundario"
                        [disabled]="generando() !== null"
                        [attr.aria-busy]="generando() === s.id || null"
                        [attr.aria-label]="'Generar enlace para ' + s.fullName"
                        (click)="generar(s)"
                      >
                        {{ generando() === s.id ? 'Generando…' : 'Generar enlace' }}
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                @if (!errorCarga()) {
                  <tr>
                    <td colspan="4">
                      <div class="vacio">
                        <strong>No hay solicitudes pendientes.</strong>
                        <span>Aparecen aquí cuando un usuario pide recuperar su contraseña.</span>
                      </div>
                    </td>
                  </tr>
                }
              }
            }
          </tbody>
        </table>
        @if (cargando()) {
          <p class="oculto" role="status">Cargando solicitudes…</p>
        }
        @if (!cargando() && totalPaginas() > 1) {
          <nav class="paginacion" aria-label="Paginación de solicitudes de recuperación">
            <span class="numerico">{{ rango() }}</span>
            <div>
              <button
                type="button"
                class="secundario"
                [disabled]="pagina() === 1"
                (click)="irA(pagina() - 1)"
              >
                Anterior
              </button>
              <button
                type="button"
                class="secundario"
                [disabled]="pagina() === totalPaginas()"
                (click)="irA(pagina() + 1)"
              >
                Siguiente
              </button>
            </div>
          </nav>
        }
      </section>
    </div>
  `,
})
export class Recuperaciones implements OnInit {
  private readonly api = inject(RecuperacionApi);

  protected readonly filasEsqueleto = [1, 2, 3];

  protected readonly pagina = signal(1);
  protected readonly solicitudes = signal<SolicitudRecuperacion[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);
  /** Id de la solicitud cuyo enlace se está generando. */
  protected readonly generando = signal<string | null>(null);
  protected readonly generado = signal<EnlaceGenerado | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly aviso = signal('');

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / TAMANO_PAGINA)),
  );
  protected readonly rango = computed(() => {
    const desde = (this.pagina() - 1) * TAMANO_PAGINA + 1;
    const hasta = desde + this.solicitudes().length - 1;
    return `${desde}–${hasta} de ${this.total()}`;
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  protected rol(role: string): string {
    return ROLES[role] ?? role;
  }

  async irA(pagina: number): Promise<void> {
    this.pagina.set(pagina);
    await this.cargar();
  }

  async generar(solicitud: SolicitudRecuperacion): Promise<void> {
    this.generando.set(solicitud.id);
    this.error.set(null);
    this.aviso.set('');
    try {
      const enlace = await firstValueFrom(this.api.generarEnlace(solicitud.id));
      this.generado.set({ solicitud, enlace });
    } catch (e) {
      const tipo = tipoDeError(e);
      if (tipo === 'transicion-invalida') {
        this.error.set(
          `${solicitud.fullName} ya definió su contraseña nueva; la solicitud se cerró.`,
        );
      } else if (tipo === 'no-encontrado') {
        this.error.set('Esa solicitud ya no existe. Revisa la lista actualizada.');
      } else {
        this.error.set(mensajeDeError(e));
      }
      // La solicitud ya no está pendiente: se recarga la lista.
      if (tipo === 'transicion-invalida' || tipo === 'no-encontrado') {
        void this.cargar();
      }
    } finally {
      this.generando.set(null);
    }
  }

  protected async copiar(enlace: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(enlace);
      this.aviso.set('Enlace copiado.');
    } catch {
      this.aviso.set('No se pudo copiar el enlace. Selecciónalo y cópialo a mano.');
    }
  }

  protected cerrarEnlace(): void {
    this.generado.set(null);
    this.aviso.set('');
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(null);
    try {
      const resultado = await firstValueFrom(this.api.pendientes(this.pagina(), TAMANO_PAGINA));
      // Si la última página quedó vacía, se vuelve a la anterior.
      if (resultado.items.length === 0 && this.pagina() > 1 && resultado.totalItems > 0) {
        this.pagina.update((p) => p - 1);
        return await this.cargar();
      }
      this.solicitudes.set(resultado.items);
      this.total.set(resultado.totalItems);
    } catch (e) {
      this.errorCarga.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
