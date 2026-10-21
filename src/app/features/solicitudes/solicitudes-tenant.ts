import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { erroresDeCampo, mensajeDeError, tipoDeError } from '../../core/http';
import { DialogoConfirmacion } from '../../shared/dialogo-confirmacion';
import {
  ESTADOS_ACTIVOS,
  ESTADOS_CANCELABLES,
  ESTADOS_CERRADOS,
  EstadoSolicitud,
  EstadoSolicitudInsignia,
  PRESENTACION_SOLICITUD,
} from '../../shared/estado-solicitud';
import { Icono } from '../../shared/icono';
import { actualizarCadaMinuto } from './actualizacion';
import {
  MOTIVO_CANCELACION_MAX,
  MOTIVO_CANCELACION_MIN,
  ResumenSolicitudes,
  SolicitudAdmin,
  SolicitudesApi,
} from './solicitudes-api';

export const TAMANO_PAGINA = 20;

/**
 * Últimos 8 caracteres del identificador: el contrato no trae el nombre del cliente. Los IDs son UUIDv7 y su comienzo es
 * la marca de tiempo, que se repite entre usuarios creados en el mismo minuto; el final es aleatorio.
 */
export function idCorto(id: string): string {
  return id.slice(-8);
}

/**
 * Solicitudes del tenant para su administrador (RF-18, SCRUM-104): conteos por estado, separados en activas y cerradas,
 * las creadas hoy y la lista paginada, filtrable por estado al tocar un conteo. Se actualiza cada minuto; si una
 * actualización falla, se conservan los datos anteriores con un aviso.
 *
 * Una solicitud que todavía no inició se puede cancelar con un motivo (RF-36, SCRUM-477); la cancelación queda en la
 * auditoría del servicio y el backend vuelve a validar el estado.
 */
@Component({
  selector: 'app-solicitudes-tenant',
  imports: [DatePipe, DialogoConfirmacion, EstadoSolicitudInsignia, Icono],
  styleUrl: './solicitudes.scss',
  template: `
    @if (error()) {
      <p class="alerta" role="alert">{{ error() }}</p>
    }
    @if (conflicto()) {
      <p class="alerta" role="alert">{{ conflicto() }}</p>
    }
    <p class="oculto" role="status">{{ aviso() }}</p>

    <section class="tarjeta conteos" aria-labelledby="titulo-activas" [attr.aria-busy]="!resumen()">
      <div class="cabecera-conteos">
        <h3 id="titulo-activas">Activas</h3>
        @if (resumen(); as r) {
          <span class="secundario">
            Actualizado a las
            <time [attr.datetime]="r.generatedAt">{{ r.generatedAt | date: 'HH:mm' }}</time>
          </span>
        }
      </div>
      <div class="grupo" role="group" aria-label="Filtrar por estado">
        @for (e of activos; track e) {
          <button
            type="button"
            class="conteo"
            [attr.aria-label]="etiqueta(e) + ': ' + cifra(e)"
            [attr.aria-pressed]="estado() === e"
            (click)="filtrar(e)"
          >
            <span class="cifra numerico">{{ cifra(e) }}</span>
            <span class="etiqueta">{{ etiqueta(e) }}</span>
          </button>
        }
      </div>
      <div class="cerradas">
        <h3 class="oculto">Cerradas</h3>
        <span>Cerradas:</span>
        @for (e of cerrados; track e) {
          <button
            type="button"
            class="filtro"
            [attr.aria-pressed]="estado() === e"
            (click)="filtrar(e)"
          >
            {{ etiqueta(e) }}
            <span class="numerico">{{ cifra(e) }}</span>
          </button>
        }
        <span class="hoy">
          Creadas hoy:
          <strong class="numerico">{{ resumen() ? resumen()!.createdToday : '–' }}</strong>
        </span>
      </div>
    </section>

    <section class="tarjeta contenedor-tabla">
      <div class="herramientas">
        <span>{{ tituloTabla() }}</span>
        @if (estado()) {
          <button type="button" class="filtro" (click)="filtrar(null)">Ver todas</button>
        }
      </div>
      <table [attr.aria-busy]="cargando()">
        <caption class="oculto">
          {{
            tituloTabla()
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Estado</th>
            <th scope="col">Categoría</th>
            <th scope="col">Cliente</th>
            <th scope="col">Tipo</th>
            <th scope="col">Técnico</th>
            <th scope="col">Creada</th>
            <th scope="col">Asignada</th>
            <th scope="col"><span class="oculto">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          @if (cargando()) {
            @for (fila of filasEsqueleto; track fila) {
              <tr class="fila-esqueleto" aria-hidden="true">
                <td><span class="esqueleto ancho-md"></span></td>
                <td><span class="esqueleto ancho-md"></span></td>
                <td><span class="esqueleto ancho-sm"></span></td>
                <td><span class="esqueleto ancho-sm"></span></td>
                <td><span class="esqueleto ancho-sm"></span></td>
                <td><span class="esqueleto ancho-md"></span></td>
                <td><span class="esqueleto ancho-md"></span></td>
                <td></td>
              </tr>
            }
          } @else {
            @for (s of solicitudes(); track s.id) {
              <tr>
                <td data-etiqueta="Estado"><app-estado-solicitud [estado]="s.status" /></td>
                <td data-etiqueta="Categoría">{{ categoria(s.categoryId) }}</td>
                <td data-etiqueta="Cliente">
                  <span class="id">
                    <code [attr.title]="s.clientId">{{ corto(s.clientId) }}</code>
                    <button
                      type="button"
                      class="boton-icono copiar"
                      [attr.aria-label]="'Copiar el ID completo del cliente ' + corto(s.clientId)"
                      title="Copiar ID completo"
                      (click)="copiar(s.clientId)"
                    >
                      <app-icono nombre="copiar" [tamano]="16" />
                    </button>
                  </span>
                </td>
                <td data-etiqueta="Tipo">
                  @if (s.clientType === 'empresa') {
                    <span class="tipo-cliente empresa">Empresa</span>
                    @if (s.siteName) {
                      <span class="sede">{{ s.siteName }}</span>
                    }
                  } @else {
                    <span class="tipo-cliente">Hogar</span>
                  }
                </td>
                <td data-etiqueta="Técnico">
                  @if (s.technicianId) {
                    @if (tecnico(s.technicianId); as nombre) {
                      {{ nombre }}
                    } @else {
                      <code [attr.title]="s.technicianId">{{ corto(s.technicianId) }}</code>
                    }
                  } @else {
                    <span class="secundario">Sin asignar</span>
                  }
                </td>
                <td data-etiqueta="Creada">
                  <time [attr.datetime]="s.createdAt">{{
                    s.createdAt | date: 'dd/MM/yyyy HH:mm'
                  }}</time>
                </td>
                <td data-etiqueta="Asignada">
                  @if (s.assignedAt) {
                    <time [attr.datetime]="s.assignedAt">{{
                      s.assignedAt | date: 'dd/MM/yyyy HH:mm'
                    }}</time>
                  } @else {
                    <span class="secundario">—</span>
                  }
                </td>
                <td class="acciones">
                  @if (cancelable(s)) {
                    <button
                      type="button"
                      class="secundario peligro"
                      [attr.aria-label]="
                        'Cancelar la solicitud de ' +
                        categoria(s.categoryId) +
                        ' del cliente ' +
                        corto(s.clientId)
                      "
                      (click)="pedirCancelacion(s)"
                    >
                      Cancelar
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8">
                  <div class="vacio">
                    <strong>{{ textoVacio() }}</strong>
                    <span>Las solicitudes aparecen aquí cuando los clientes las crean.</span>
                  </div>
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
      @if (cargando()) {
        <p class="oculto" role="status">Cargando solicitudes…</p>
      }
      @if (!cargando() && totalPaginas() > 1) {
        <nav class="paginacion" aria-label="Paginación de solicitudes">
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
      [abierto]="porCancelar() !== null"
      titulo="¿Cancelar esta solicitud?"
      textoConfirmar="Sí, cancelar"
      textoCancelar="Volver"
      [peligro]="true"
      [ocupado]="cancelando()"
      (confirmar)="confirmarCancelacion()"
      (cancelar)="cerrarCancelacion()"
    >
      @if (porCancelar(); as s) {
        <p>
          La solicitud de {{ categoria(s.categoryId) }} del cliente {{ corto(s.clientId) }} pasa a
          cancelada:
          {{
            s.technicianId
              ? 'el técnico asignado queda libre para otros servicios.'
              : 'se deja de buscar técnico.'
          }}
          El cliente verá el motivo y la acción queda en la auditoría. No se puede deshacer.
        </p>
        <div class="campo-motivo">
          <label for="motivo-cancelacion">Motivo</label>
          <textarea
            id="motivo-cancelacion"
            rows="3"
            [attr.maxlength]="motivoMax"
            [attr.aria-invalid]="errorMotivo() !== null"
            [attr.aria-describedby]="
              errorMotivo()
                ? 'motivo-cancelacion-error motivo-cancelacion-cuenta'
                : 'motivo-cancelacion-cuenta'
            "
            [value]="motivo()"
            (input)="escribirMotivo($event)"
          ></textarea>
          <span id="motivo-cancelacion-cuenta" class="secundario numerico"
            >{{ motivo().trim().length }}/{{ motivoMax }}</span
          >
          @if (errorMotivo()) {
            <p id="motivo-cancelacion-error" class="error-campo">{{ errorMotivo() }}</p>
          }
        </div>
        @if (errorCancelacion()) {
          <p class="alerta" role="alert">{{ errorCancelacion() }}</p>
        }
      }
    </app-dialogo-confirmacion>
  `,
})
export class SolicitudesTenant implements OnInit {
  private readonly api = inject(SolicitudesApi);

  protected readonly activos = ESTADOS_ACTIVOS;
  protected readonly cerrados = ESTADOS_CERRADOS;
  protected readonly filasEsqueleto = [1, 2, 3];
  protected readonly corto = idCorto;
  protected readonly motivoMax = MOTIVO_CANCELACION_MAX;

  protected readonly resumen = signal<ResumenSolicitudes | null>(null);
  protected readonly estado = signal<EstadoSolicitud | null>(null);
  protected readonly pagina = signal(1);
  protected readonly solicitudes = signal<SolicitudAdmin[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);
  private readonly errorResumen = signal<string | null>(null);
  private readonly errorLista = signal<string | null>(null);
  protected readonly error = computed(() => this.errorResumen() ?? this.errorLista());
  protected readonly aviso = signal('');
  private readonly categorias = signal<ReadonlyMap<string, string>>(new Map());
  private readonly tecnicos = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly porCancelar = signal<SolicitudAdmin | null>(null);
  protected readonly motivo = signal('');
  protected readonly errorMotivo = signal<string | null>(null);
  protected readonly errorCancelacion = signal<string | null>(null);
  protected readonly cancelando = signal(false);
  /** Aviso visible cuando la cancelación llegó tarde (409); se quita al pedir otra. */
  protected readonly conflicto = signal<string | null>(null);

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / TAMANO_PAGINA)),
  );
  protected readonly rango = computed(() => {
    const desde = (this.pagina() - 1) * TAMANO_PAGINA + 1;
    const hasta = desde + this.solicitudes().length - 1;
    return `${desde}–${hasta} de ${this.total()}`;
  });
  protected readonly tituloTabla = computed(() => {
    const estado = this.estado();
    return estado ? `Solicitudes: ${this.etiqueta(estado).toLowerCase()}` : 'Todas las solicitudes';
  });
  protected readonly textoVacio = computed(() => {
    const estado = this.estado();
    return estado
      ? `No hay solicitudes en «${this.etiqueta(estado).toLowerCase()}».`
      : 'Tu empresa todavía no tiene solicitudes.';
  });

  constructor() {
    actualizarCadaMinuto(() => void this.actualizar());
  }

  async ngOnInit(): Promise<void> {
    void this.cargarCategorias();
    void this.cargarTecnicos();
    await Promise.all([this.cargarResumen(), this.cargar()]);
  }

  protected etiqueta(estado: EstadoSolicitud): string {
    return PRESENTACION_SOLICITUD[estado].etiqueta;
  }

  /** Conteo del estado; «–» mientras no hay resumen. */
  protected cifra(estado: EstadoSolicitud): string {
    const resumen = this.resumen();
    return resumen ? String(resumen.byStatus[estado]) : '–';
  }

  /** Nombre de la categoría; si ya no está activa en el catálogo no se muestra su identificador. */
  protected categoria(id: string): string {
    return this.categorias().get(id) ?? '—';
  }

  /** Nombre del técnico; si no está en la lista del tenant se muestra su ID corto. */
  protected tecnico(id: string): string | undefined {
    return this.tecnicos().get(id);
  }

  /** El contrato no trae el nombre del cliente: el administrador puede copiar su ID completo. */
  protected async copiar(id: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(id);
      this.aviso.set('ID del cliente copiado.');
    } catch {
      this.aviso.set('No se pudo copiar el ID.');
    }
  }

  protected cancelable(s: SolicitudAdmin): boolean {
    return ESTADOS_CANCELABLES.includes(s.status);
  }

  pedirCancelacion(s: SolicitudAdmin): void {
    this.motivo.set('');
    this.errorMotivo.set(null);
    this.errorCancelacion.set(null);
    this.conflicto.set(null);
    this.porCancelar.set(s);
  }

  cerrarCancelacion(): void {
    this.porCancelar.set(null);
  }

  protected escribirMotivo(evento: Event): void {
    this.motivo.set((evento.target as HTMLTextAreaElement).value);
    this.errorMotivo.set(null);
  }

  /**
   * Cancela con el motivo sin espacios. Un 409 significa que el servicio ya inició o que alguien la canceló antes: se
   * cierra el diálogo y se actualiza la lista para mostrar el estado real.
   */
  async confirmarCancelacion(): Promise<void> {
    const solicitud = this.porCancelar();
    if (!solicitud) {
      return;
    }
    const motivo = this.motivo().trim();
    if (motivo.length < MOTIVO_CANCELACION_MIN || motivo.length > MOTIVO_CANCELACION_MAX) {
      this.errorMotivo.set(
        `Escribe un motivo de ${MOTIVO_CANCELACION_MIN} a ${MOTIVO_CANCELACION_MAX} caracteres.`,
      );
      return;
    }
    this.cancelando.set(true);
    this.errorCancelacion.set(null);
    try {
      await firstValueFrom(this.api.cancelar(solicitud.id, motivo));
      this.porCancelar.set(null);
      this.aviso.set(`Solicitud del cliente ${idCorto(solicitud.clientId)} cancelada.`);
      await this.actualizar();
    } catch (e) {
      if (
        e instanceof HttpErrorResponse &&
        e.status === 409 &&
        tipoDeError(e) === 'transicion-invalida'
      ) {
        this.porCancelar.set(null);
        this.conflicto.set(
          'La solicitud ya no se puede cancelar: el servicio inició o ya estaba cancelada.',
        );
        await this.actualizar();
      } else {
        const campo = erroresDeCampo(e)['reason'];
        if (campo) {
          this.errorMotivo.set(campo);
        } else {
          this.errorCancelacion.set(mensajeDeError(e));
        }
      }
    } finally {
      this.cancelando.set(false);
    }
  }

  /** Tocar el conteo del filtro activo lo quita. */
  async filtrar(estado: EstadoSolicitud | null): Promise<void> {
    this.estado.set(estado === this.estado() ? null : estado);
    this.pagina.set(1);
    await this.cargar();
  }

  async irA(pagina: number): Promise<void> {
    this.pagina.set(pagina);
    await this.cargar();
  }

  /** Actualización periódica: conteos y página actual sin quitar lo que se ve mientras llega. */
  private async actualizar(): Promise<void> {
    await Promise.all([this.cargarResumen(), this.cargar(true)]);
  }

  private async cargarResumen(): Promise<void> {
    try {
      this.resumen.set(await firstValueFrom(this.api.resumen()));
      this.errorResumen.set(null);
    } catch (e) {
      this.errorResumen.set(this.textoError(e));
    }
  }

  private async cargar(silencioso = false): Promise<void> {
    if (!silencioso) {
      this.cargando.set(true);
    }
    try {
      const resultado = await firstValueFrom(
        this.api.listar(this.estado(), this.pagina(), TAMANO_PAGINA),
      );
      // Si la página quedó vacía porque las solicitudes cambiaron de estado, se vuelve a la anterior.
      if (resultado.items.length === 0 && this.pagina() > 1 && resultado.totalItems > 0) {
        this.pagina.update((p) => p - 1);
        return await this.cargar(silencioso);
      }
      this.solicitudes.set(resultado.items);
      this.total.set(resultado.totalItems);
      this.errorLista.set(null);
    } catch (e) {
      this.errorLista.set(this.textoError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Con datos ya en pantalla se aclara que siguen siendo los anteriores. */
  private textoError(e: unknown): string {
    const mensaje = mensajeDeError(e);
    return this.resumen() ? `No pudimos actualizar las solicitudes. ${mensaje}` : mensaje;
  }

  /** Nombres de los técnicos del tenant, de a 100 por página hasta tenerlos todos. */
  private async cargarTecnicos(): Promise<void> {
    const nombres = new Map<string, string>();
    try {
      for (let pagina = 1; ; pagina++) {
        const resultado = await firstValueFrom(this.api.tecnicos(pagina));
        resultado.items.forEach((t) => nombres.set(t.userId, t.fullName));
        if (resultado.items.length === 0 || nombres.size >= resultado.totalItems) {
          break;
        }
      }
    } catch {
      // Sin la lista, el técnico se muestra con su ID corto.
    }
    this.tecnicos.set(nombres);
  }

  private async cargarCategorias(): Promise<void> {
    try {
      const lista = await firstValueFrom(this.api.categorias());
      this.categorias.set(new Map(lista.map((c) => [c.id, c.name])));
    } catch {
      // Sin categorías la tabla sigue funcionando; la categoría se muestra como «—».
    }
  }
}
