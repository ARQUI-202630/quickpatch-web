import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../core/sesion';

/** Estado del tenant (`TenantStatus`, identity.v1.yaml 1.2.0). */
export type EstadoTenant = 'activo' | 'inactivo';

/** Esquema `Tenant` del contrato. */
export interface Tenant {
  id: string;
  name: string;
  nit: string;
  status: EstadoTenant;
  createdAt: string;
}

/** Operaciones de plataforma de Identity (RF-21, DD 10.4); solo `admin_plataforma`. */
@Injectable({ providedIn: 'root' })
export class TenantsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  listar(): Observable<Tenant[]> {
    return this.http.get<Tenant[]>(`${this.base}/v1/platform/tenants`);
  }

  cambiarEstado(id: string, status: EstadoTenant): Observable<Tenant> {
    return this.http.patch<Tenant>(`${this.base}/v1/platform/tenants/${id}`, { status });
  }
}
