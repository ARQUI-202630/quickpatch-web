import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { mensajeDeError } from '../../core/http';
import {
  ESTADOS_ACTIVOS,
  ESTADOS_SOLICITUD,
  EstadoSolicitud,
  PRESENTACION_SOLICITUD,
} from '../../shared/estado-solicitud';
import { actualizarCadaMinuto } from './actualizacion';
import {
  ConteoPorEstado,
  ResumenPlataforma,
  SolicitudesApi,
  TenantNombre,
} from './solicitudes-api';

interface FilaTenant {
  tenantId: string;
  nombre: string;
  byStatus: ConteoPorEstado;
  activas: number;
  createdToday: number;
}

const SIN_SOLICITUDES = Object.fromEntries(ESTADOS_SOLICITUD.map((e) => [e, 0])) as ConteoPorEstado;

/**
 * Conteos de solicitudes por estado de cada tenant para el administrador de plataforma (RF-18, SCRUM-104; DEP-15): no
 * ve solicitudes ni datos de los clientes. Los nombres salen de los tenants de Identity, y un tenant sin solicitudes
 * aparece con 0. Se filtra por tenant con el parámetro `tenantId` de la operación de plataforma.
 */
@Component({
  selector: 'app-solicitudes-plataforma',
  imports: [DatePipe],
  styleUrl: './solicitudes.scss',
  template: `
    @if (error()) {
      <p class="alerta" role="alert">{{ error() }}</p>
    }

    <section class="tarjeta contenedor-tabla">
      <div class="herramientas">
        <label for="filtro-tenant">Tenant</label>
        <select id="filtro-tenant" [value]="tenantId() ?? ''" (change)="elegirTenant($event)">
          <option value="">Todos</option>
          @for (t of tenants(); track t.id) {
            <option [value]="t.id">{{ t.name }}</option>
          }
        </select>
        @if (resumen(); as r) {
          <span class="secundario actualizado">
            Actualizado a las
            <time [attr.datetime]="r.generatedAt">{{ r.generatedAt | date: 'HH:mm' }}</time>
          </span>
        }
      </div>
      <div class="desplazable">
        <table class="tabla-conteos" [attr.aria-busy]="cargando()">
          <caption class="oculto">
            Solicitudes por estado de cada tenant
          </caption>
          <thead>
            <tr>
              <th scope="col">Tenant</th>
              <th scope="col" class="cifra">Activas</th>
              @for (e of estados; track e) {
                <th scope="col" class="cifra">{{ etiqueta(e) }}</th>
              }
              <th scope="col" class="cifra">Creadas hoy</th>
            </tr>
          </thead>
          <tbody>
            @if (cargando()) {
              @for (fila of filasEsqueleto; track fila) {
                <tr class="fila-esqueleto" aria-hidden="true">
                  <td><span class="esqueleto ancho-lg"></span></td>
                  @for (c of columnasEsqueleto; track c) {
                    <td><span class="esqueleto ancho-xs"></span></td>
                  }
                </tr>
              }
            } @else {
              @for (f of filas(); track f.tenantId) {
                <tr>
                  <th scope="row" data-etiqueta="Tenant">{{ f.nombre }}</th>
                  <td class="cifra numerico activas" data-etiqueta="Activas">
                    <strong>{{ f.activas }}</strong>
                  </td>
                  @for (e of estados; track e) {
                    <td class="cifra numerico" [attr.data-etiqueta]="etiqueta(e)">
                      {{ f.byStatus[e] }}
                    </td>
                  }
                  <td class="cifra numerico" data-etiqueta="Creadas hoy">{{ f.createdToday }}</td>
                </tr>
              } @empty {
                <tr>
                  <td [attr.colspan]="estados.length + 3">
                    <div class="vacio">
                      <strong>No hay tenants para mostrar.</strong>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
      @if (cargando()) {
        <p class="oculto" role="status">Cargando conteos…</p>
      }
    </section>
  `,
})
export class SolicitudesPlataforma implements OnInit {
  private readonly api = inject(SolicitudesApi);

  protected readonly estados = ESTADOS_SOLICITUD;
  protected readonly filasEsqueleto = [1, 2, 3];
  protected readonly columnasEsqueleto = Array.from(
    { length: ESTADOS_SOLICITUD.length + 2 },
    (_, i) => i,
  );

  protected readonly tenants = signal<TenantNombre[]>([]);
  protected readonly tenantId = signal<string | null>(null);
  protected readonly resumen = signal<ResumenPlataforma | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  /**
   * Una fila por tenant de Identity (con 0 si no tiene solicitudes) y, si el resumen trae un tenant que Identity no
   * devolvió, también se muestra con su identificador.
   */
  protected readonly filas = computed<FilaTenant[]>(() => {
    const resumen = this.resumen();
    if (!resumen) {
      return [];
    }
    const elegido = this.tenantId();
    const conteos = new Map(resumen.tenants.map((t) => [t.tenantId, t]));
    const nombres = this.tenants().filter((t) => !elegido || t.id === elegido);
    const ids = [
      ...nombres.map((t) => t.id),
      ...[...conteos.keys()].filter((id) => !nombres.some((t) => t.id === id)),
    ];
    return ids.map((id) => {
      const conteo = conteos.get(id);
      const byStatus = conteo?.byStatus ?? SIN_SOLICITUDES;
      return {
        tenantId: id,
        nombre: nombres.find((t) => t.id === id)?.name ?? id,
        byStatus,
        activas: ESTADOS_ACTIVOS.reduce((suma, e) => suma + byStatus[e], 0),
        createdToday: conteo?.createdToday ?? 0,
      };
    });
  });

  constructor() {
    actualizarCadaMinuto(() => void this.cargar(true));
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.cargarTenants(), this.cargar()]);
  }

  protected etiqueta(estado: EstadoSolicitud): string {
    return PRESENTACION_SOLICITUD[estado].etiqueta;
  }

  protected async elegirTenant(evento: Event): Promise<void> {
    this.tenantId.set((evento.target as HTMLSelectElement).value || null);
    await this.cargar();
  }

  private async cargar(silencioso = false): Promise<void> {
    if (!silencioso) {
      this.cargando.set(true);
    }
    try {
      this.resumen.set(await firstValueFrom(this.api.resumenPlataforma(this.tenantId())));
      this.error.set(null);
    } catch (e) {
      const mensaje = mensajeDeError(e);
      this.error.set(this.resumen() ? `No pudimos actualizar los conteos. ${mensaje}` : mensaje);
    } finally {
      this.cargando.set(false);
    }
  }

  private async cargarTenants(): Promise<void> {
    try {
      this.tenants.set(await firstValueFrom(this.api.tenants()));
    } catch {
      // Sin la lista de tenants los conteos se muestran con el identificador del tenant.
    }
  }
}
