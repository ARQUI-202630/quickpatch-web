import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { mensajeDeError } from '../../core/http';
import { DialogoConfirmacion } from '../../shared/dialogo-confirmacion';
import { ErrorCarga } from '../../shared/error-carga';
import { EstadoVerificacion, EstadoVerificacionInsignia } from '../../shared/estado-verificacion';
import { Insignia } from '../../shared/insignia';
import { AccionVerificacion, TecnicoAdmin, TecnicosApi } from './tecnicos-api';

interface Filtro {
  estado: EstadoVerificacion | null;
  etiqueta: string;
}

const FILTROS: readonly Filtro[] = [
  { estado: 'pendiente', etiqueta: 'Pendientes' },
  { estado: 'aprobado', etiqueta: 'Aprobados' },
  { estado: 'rechazado', etiqueta: 'Rechazados' },
  { estado: 'suspendido', etiqueta: 'Suspendidos' },
  { estado: null, etiqueta: 'Todos' },
];

interface Accion {
  accion: AccionVerificacion;
  etiqueta: string;
  peligro: boolean;
  /** Texto propio cuando la misma acción tiene otro sentido (reactivar es `approve` desde suspendido). */
  consecuencia?: string;
  hecho?: string;
}

/** Transiciones que admite cada estado (DD 8.3.13). Cualquier otra responde 409 `transicion-invalida`. */
const ACCIONES: Record<EstadoVerificacion, readonly Accion[]> = {
  pendiente: [
    { accion: 'approve', etiqueta: 'Aprobar', peligro: false },
    { accion: 'reject', etiqueta: 'Rechazar', peligro: true },
  ],
  aprobado: [{ accion: 'suspend', etiqueta: 'Suspender', peligro: true }],
  rechazado: [{ accion: 'approve', etiqueta: 'Aprobar', peligro: false }],
  suspendido: [
    {
      accion: 'approve',
      etiqueta: 'Reactivar',
      peligro: false,
      consecuencia: 'Volverá a recibir solicitudes de servicio de los clientes de tu empresa.',
      hecho: 'reactivado',
    },
  ],
};

const CONSECUENCIA: Record<AccionVerificacion, string> = {
  approve: 'Podrá recibir solicitudes de servicio de los clientes de tu empresa.',
  reject: 'No podrá recibir solicitudes. El técnico verá el motivo.',
  suspend:
    'Dejará de recibir solicitudes nuevas; un servicio en curso no se interrumpe. El técnico verá el motivo.',
};

const HECHO: Record<AccionVerificacion, string> = {
  approve: 'aprobado',
  reject: 'rechazado',
  suspend: 'suspendido',
};

export const TAMANO_PAGINA = 20;
const MOTIVO_MIN = 5;
const MOTIVO_MAX = 500;

interface CambioPendiente {
  tecnico: TecnicoAdmin;
  accion: Accion;
}

/**
 * Verificación de técnicos y proveedores (RF-19, RF-20, SCRUM-107, SCRUM-110): lista los del tenant por estado, con paginación
 * del servidor, y permite aprobar, rechazar, suspender o reactivar según la tabla del DD 8.3.13. Rechazar y suspender
 * piden un motivo de 5 a 500 caracteres; toda acción pide confirmación.
 */
@Component({
  selector: 'app-tecnicos',
  imports: [DatePipe, DialogoConfirmacion, ErrorCarga, EstadoVerificacionInsignia, Insignia],
  styleUrl: './tecnicos.scss',
  template: `
    <div class="pagina">
      <header class="encabezado-pagina">
        <div>
          <h2>Técnicos</h2>
          <p>
            Técnicos y proveedores de tu empresa. Solo los aprobados reciben solicitudes de
            servicio. La reputación baja solo los señala: suspender sigue siendo tu decisión.
          </p>
        </div>
      </header>

      @if (errorCarga(); as mensaje) {
        <app-error-carga [mensaje]="mensaje" (reintentar)="cargar()" />
      }
      @if (error() && !pendiente()) {
        <p class="alerta" role="alert">{{ error() }}</p>
      }
      <p class="aviso" role="status">{{ aviso() }}</p>

      <section class="tarjeta contenedor-tabla">
        <div class="herramientas" role="group" aria-label="Filtrar por estado de verificación">
          @for (f of filtros; track f.etiqueta) {
            <button
              type="button"
              class="filtro"
              [attr.aria-pressed]="f.estado === estado()"
              (click)="filtrar(f.estado)"
            >
              {{ f.etiqueta }}
            </button>
          }
          <button
            type="button"
            class="filtro filtro-reputacion"
            [attr.aria-pressed]="soloReputacionBaja()"
            (click)="alternarReputacionBaja()"
          >
            Reputación baja
          </button>
        </div>
        <table [attr.aria-busy]="cargando()">
          <caption class="oculto">
            {{
              tituloTabla()
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Tipo</th>
              <th scope="col">Documento</th>
              <th scope="col">Especialidad</th>
              <th scope="col">Estado</th>
              <th scope="col">Calificación</th>
              <th scope="col">Registro</th>
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
                  <td><span class="esqueleto ancho-md"></span></td>
                  <td><span class="esqueleto ancho-sm"></span></td>
                  <td><span class="esqueleto ancho-sm"></span></td>
                  <td><span class="esqueleto ancho-md"></span></td>
                  <td></td>
                </tr>
              }
            } @else {
              @for (t of tecnicos(); track t.userId) {
                <tr>
                  <td data-etiqueta="Nombre">
                    <span class="nombre">{{ t.fullName }}</span>
                    <span class="secundario">{{ t.email }}</span>
                  </td>
                  <td data-etiqueta="Tipo">
                    {{ t.role === 'proveedor' ? 'Proveedor' : 'Técnico' }}
                  </td>
                  <td data-etiqueta="Documento">{{ t.documentId }}</td>
                  <td data-etiqueta="Especialidad">{{ especialidad(t.specialtyId) }}</td>
                  <td data-etiqueta="Estado">
                    <span class="estado">
                      <app-estado-verificacion [estado]="t.verificationStatus" />
                      @if (t.verificationReason) {
                        <span class="secundario motivo">{{ t.verificationReason }}</span>
                      }
                    </span>
                  </td>
                  <td data-etiqueta="Calificación">
                    <span class="calificacion">
                      @if (t.averageRating !== null && t.averageRating !== undefined) {
                        <span class="numerico"
                          >{{ promedio(t.averageRating) }}
                          <span class="secundario">({{ t.ratingCount ?? 0 }})</span></span
                        >
                      } @else {
                        <span class="secundario">Sin calificaciones</span>
                      }
                      @if (t.lowReputation) {
                        <app-insignia tono="peligro">Reputación baja</app-insignia>
                      }
                    </span>
                  </td>
                  <td data-etiqueta="Registro">
                    <time [attr.datetime]="t.createdAt">{{
                      t.createdAt | date: 'dd/MM/yyyy'
                    }}</time>
                  </td>
                  <td class="acciones">
                    <div class="botones">
                      @for (a of acciones(t); track a.accion) {
                        <button
                          type="button"
                          class="secundario"
                          [class.peligro]="a.peligro"
                          [attr.aria-label]="a.etiqueta + ' a ' + t.fullName"
                          (click)="pedirCambio(t, a)"
                        >
                          {{ a.etiqueta }}
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                @if (!errorCarga()) {
                  <tr>
                    <td colspan="8">
                      <div class="vacio">
                        <strong>{{ textoVacio() }}</strong>
                        <span>Los técnicos y proveedores aparecen aquí cuando se registran.</span>
                      </div>
                    </td>
                  </tr>
                }
              }
            }
          </tbody>
        </table>
        @if (cargando()) {
          <p class="oculto" role="status">Cargando técnicos…</p>
        }
        @if (!cargando() && totalPaginas() > 1) {
          <nav class="paginacion" aria-label="Paginación de técnicos">
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

      <app-dialogo-confirmacion
        [abierto]="pendiente() !== null"
        [titulo]="tituloDialogo()"
        [textoConfirmar]="'Sí, ' + (pendiente()?.accion?.etiqueta ?? '').toLowerCase()"
        [peligro]="pendiente()?.accion?.peligro ?? false"
        [ocupado]="guardando()"
        (confirmar)="confirmar()"
        (cancelar)="cancelarCambio()"
      >
        @if (pendiente(); as cambio) {
          <p>{{ consecuencia(cambio.accion) }}</p>
          @if (pideMotivo()) {
            <div class="campo-motivo">
              <label for="motivo">Motivo</label>
              <textarea
                id="motivo"
                rows="3"
                [attr.maxlength]="motivoMax"
                [attr.aria-invalid]="errorMotivo() !== null"
                [attr.aria-describedby]="
                  errorMotivo() ? 'motivo-error motivo-cuenta' : 'motivo-cuenta'
                "
                [value]="motivo()"
                (input)="escribirMotivo($event)"
              ></textarea>
              <span id="motivo-cuenta" class="secundario numerico"
                >{{ motivo().trim().length }}/{{ motivoMax }}</span
              >
              @if (errorMotivo()) {
                <p id="motivo-error" class="error-campo">{{ errorMotivo() }}</p>
              }
            </div>
          }
        }
        @if (error() && pendiente()) {
          <p class="alerta" role="alert">{{ error() }}</p>
        }
      </app-dialogo-confirmacion>
    </div>
  `,
})
export class Tecnicos implements OnInit {
  private readonly api = inject(TecnicosApi);

  protected readonly filtros = FILTROS;
  protected readonly filasEsqueleto = [1, 2, 3];
  protected readonly motivoMax = MOTIVO_MAX;

  protected readonly estado = signal<EstadoVerificacion | null>('pendiente');
  protected readonly soloReputacionBaja = signal(false);
  protected readonly pagina = signal(1);
  protected readonly tecnicos = signal<TecnicoAdmin[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly aviso = signal('');
  protected readonly pendiente = signal<CambioPendiente | null>(null);
  protected readonly motivo = signal('');
  protected readonly errorMotivo = signal<string | null>(null);
  private readonly categorias = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / TAMANO_PAGINA)),
  );
  protected readonly rango = computed(() => {
    const desde = (this.pagina() - 1) * TAMANO_PAGINA + 1;
    const hasta = desde + this.tecnicos().length - 1;
    return `${desde}–${hasta} de ${this.total()}`;
  });
  private readonly filtroActual = computed(
    () => FILTROS.find((f) => f.estado === this.estado()) ?? FILTROS[0],
  );
  protected readonly tituloTabla = computed(
    () => `Técnicos y proveedores: ${this.filtroActual().etiqueta.toLowerCase()}`,
  );
  protected readonly textoVacio = computed(() => {
    if (this.soloReputacionBaja()) {
      return this.estado() === null
        ? 'Ningún técnico tiene reputación baja.'
        : `Ningún técnico ${this.filtroActual().etiqueta.toLowerCase().replace(/s$/, '')} tiene reputación baja.`;
    }
    return this.estado() === null
      ? 'No hay técnicos ni proveedores registrados.'
      : `No hay técnicos ${this.filtroActual().etiqueta.toLowerCase()}.`;
  });
  protected readonly pideMotivo = computed(() => {
    const accion = this.pendiente()?.accion.accion;
    return accion === 'reject' || accion === 'suspend';
  });
  protected readonly tituloDialogo = computed(() => {
    const cambio = this.pendiente();
    return cambio ? `¿${cambio.accion.etiqueta} a ${cambio.tecnico.fullName}?` : '';
  });

  async ngOnInit(): Promise<void> {
    void this.cargarCategorias();
    await this.cargar();
  }

  protected acciones(t: TecnicoAdmin): readonly Accion[] {
    return ACCIONES[t.verificationStatus];
  }

  protected consecuencia(accion: Accion): string {
    return accion.consecuencia ?? CONSECUENCIA[accion.accion];
  }

  /** Nombre de la categoría; si ya no está activa en el catálogo no se muestra su identificador. */
  protected especialidad(id: string): string {
    return this.categorias().get(id) ?? '—';
  }

  async filtrar(estado: EstadoVerificacion | null): Promise<void> {
    if (estado === this.estado()) {
      return;
    }
    this.estado.set(estado);
    this.pagina.set(1);
    this.aviso.set('');
    await this.cargar();
  }

  /** Se combina con el filtro de estado (identity 1.12.0, AC9-E2). */
  async alternarReputacionBaja(): Promise<void> {
    this.soloReputacionBaja.update((v) => !v);
    this.pagina.set(1);
    this.aviso.set('');
    await this.cargar();
  }

  /** Promedio con un decimal y coma decimal, como se muestra en Colombia. */
  protected promedio(valor: number): string {
    return valor.toFixed(1).replace('.', ',');
  }

  async irA(pagina: number): Promise<void> {
    this.pagina.set(pagina);
    await this.cargar();
  }

  pedirCambio(tecnico: TecnicoAdmin, accion: Accion): void {
    this.error.set(null);
    this.motivo.set('');
    this.errorMotivo.set(null);
    this.pendiente.set({ tecnico, accion });
  }

  cancelarCambio(): void {
    this.pendiente.set(null);
    this.error.set(null);
  }

  protected escribirMotivo(evento: Event): void {
    this.motivo.set((evento.target as HTMLTextAreaElement).value);
    this.errorMotivo.set(null);
  }

  async confirmar(): Promise<void> {
    const cambio = this.pendiente();
    if (!cambio) {
      return;
    }
    const motivo = this.motivo().trim();
    if (this.pideMotivo() && (motivo.length < MOTIVO_MIN || motivo.length > MOTIVO_MAX)) {
      this.errorMotivo.set(`Escribe un motivo de ${MOTIVO_MIN} a ${MOTIVO_MAX} caracteres.`);
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.cambiarVerificacion(
          cambio.tecnico.userId,
          cambio.accion.accion,
          this.pideMotivo() ? motivo : undefined,
        ),
      );
      this.pendiente.set(null);
      const hecho = cambio.accion.hecho ?? HECHO[cambio.accion.accion];
      this.aviso.set(`${cambio.tecnico.fullName} quedó ${hecho}.`);
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeDeError(e));
      // Otro administrador cambió el estado: se recarga para mostrar las acciones que sí aplican.
      if (e instanceof HttpErrorResponse && e.status === 409) {
        void this.cargar();
      }
    } finally {
      this.guardando.set(false);
    }
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(null);
    if (!this.pendiente()) {
      this.error.set(null);
    }
    try {
      const resultado = await firstValueFrom(
        this.api.listar(this.estado(), this.pagina(), TAMANO_PAGINA, this.soloReputacionBaja()),
      );
      // Si la acción vació la última página, se vuelve a la anterior.
      if (resultado.items.length === 0 && this.pagina() > 1 && resultado.totalItems > 0) {
        this.pagina.update((p) => p - 1);
        return await this.cargar();
      }
      this.tecnicos.set(resultado.items);
      this.total.set(resultado.totalItems);
    } catch (e) {
      if (!this.pendiente()) {
        this.errorCarga.set(mensajeDeError(e));
      }
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarCategorias(): Promise<void> {
    try {
      const lista = await firstValueFrom(this.api.categorias());
      this.categorias.set(new Map(lista.map((c) => [c.id, c.name])));
    } catch {
      // Sin categorías la tabla sigue funcionando; la especialidad se muestra como «—».
    }
  }
}
