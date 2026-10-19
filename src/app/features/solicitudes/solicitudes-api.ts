import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../core/sesion';
import { EstadoSolicitud } from '../../shared/estado-solicitud';

/** Esquema `AdminServiceRequest` (service-request.v1.yaml 1.4.0): sin dirección, ubicación ni contacto. */
export interface SolicitudAdmin {
  id: string;
  status: EstadoSolicitud;
  categoryId: string;
  clientId: string;
  technicianId: string | null;
  createdAt: string;
  assignedAt: string | null;
}

/** Esquema `AdminServiceRequestPage`. */
export interface PaginaSolicitudes {
  items: SolicitudAdmin[];
  page: number;
  size: number;
  totalItems: number;
}

/** Esquema `StatusCounts`: siempre trae los 9 estados, con 0 si no hay. */
export type ConteoPorEstado = Record<EstadoSolicitud, number>;

/** Esquema `ServiceRequestSummary`; `createdToday` es el día calendario de Bogotá. */
export interface ResumenSolicitudes {
  generatedAt: string;
  byStatus: ConteoPorEstado;
  createdToday: number;
}

/** Esquema `TenantServiceRequestSummary`. */
export interface ResumenTenant {
  tenantId: string;
  byStatus: ConteoPorEstado;
  createdToday: number;
}

/** Esquema `PlatformServiceRequestSummary`; un tenant sin solicitudes no aparece en `tenants`. */
export interface ResumenPlataforma {
  generatedAt: string;
  tenants: ResumenTenant[];
}

/** Esquema `Category` (catalog.v1.yaml); solo para mostrar el nombre de la categoría. */
export interface Categoria {
  id: string;
  name: string;
}

/** Esquema `AdminTechnician` (identity.v1.yaml); solo para mostrar el nombre del técnico. */
export interface TecnicoNombre {
  userId: string;
  fullName: string;
}

/** Esquema `TechnicianPage`. */
export interface PaginaTecnicos {
  items: TecnicoNombre[];
  totalItems: number;
}

/** Máximo de técnicos por página que admite `GET /v1/admin/technicians`. */
export const TAMANO_PAGINA_TECNICOS = 100;

/** Esquema `Tenant` (identity.v1.yaml); solo para mostrar el nombre del tenant. */
export interface TenantNombre {
  id: string;
  name: string;
}

/**
 * Panel operativo de solicitudes (RF-18, SCRUM-104; service-request.v1.yaml 1.4.0). El `admin_tenant` ve las de su
 * tenant, que sale del token: la UI nunca lo envía. El `admin_plataforma` solo ve conteos por tenant (DEP-15).
 */
@Injectable({ providedIn: 'root' })
export class SolicitudesApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  listar(
    estado: EstadoSolicitud | null,
    pagina: number,
    tamano: number,
  ): Observable<PaginaSolicitudes> {
    let params = new HttpParams().set('page', pagina).set('size', tamano);
    if (estado) {
      params = params.set('status', estado);
    }
    return this.http.get<PaginaSolicitudes>(`${this.base}/v1/service-requests`, { params });
  }

  resumen(): Observable<ResumenSolicitudes> {
    return this.http.get<ResumenSolicitudes>(`${this.base}/v1/admin/service-requests/summary`);
  }

  /** Conteos de todos los tenants o, con `tenantId`, de uno solo (filtro de la operación de plataforma). */
  resumenPlataforma(tenantId: string | null): Observable<ResumenPlataforma> {
    const params = tenantId ? new HttpParams().set('tenantId', tenantId) : undefined;
    return this.http.get<ResumenPlataforma>(`${this.base}/v1/platform/service-requests/summary`, {
      params,
    });
  }

  categorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${this.base}/v1/catalog/categories`);
  }

  /** Técnicos y proveedores del tenant, en todos los estados de verificación. */
  tecnicos(pagina: number): Observable<PaginaTecnicos> {
    const params = new HttpParams().set('page', pagina).set('size', TAMANO_PAGINA_TECNICOS);
    return this.http.get<PaginaTecnicos>(`${this.base}/v1/admin/technicians`, { params });
  }

  tenants(): Observable<TenantNombre[]> {
    return this.http.get<TenantNombre[]>(`${this.base}/v1/platform/tenants`);
  }
}
