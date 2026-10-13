import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../core/sesion';
import { EstadoVerificacion } from '../../shared/estado-verificacion';

/** Esquema `AdminTechnician` (identity.v1.yaml 1.3.0). */
export interface TecnicoAdmin {
  userId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  role: 'tecnico' | 'proveedor';
  documentId: string;
  specialtyId: string;
  verificationStatus: EstadoVerificacion;
  verificationReason?: string | null;
  createdAt: string;
}

/** Esquema `TechnicianPage`. */
export interface PaginaTecnicos {
  items: TecnicoAdmin[];
  page: number;
  size: number;
  totalItems: number;
}

/** Esquema `TechnicianVerification`: respuesta de aprobar y rechazar. */
export interface VerificacionTecnico {
  userId: string;
  verificationStatus: EstadoVerificacion;
  reason: string | null;
}

/** Esquema `Category` (catalog.v1.yaml); solo para mostrar el nombre de la especialidad. */
export interface Categoria {
  id: string;
  name: string;
}

/** Acciones del administrador sobre un técnico (DD 8.3.13). */
export type AccionVerificacion = 'approve' | 'reject';

/**
 * Verificación de técnicos y proveedores (RF-19, SCRUM-107); solo `admin_tenant`. El tenant sale del token:
 * la UI nunca lo envía.
 */
@Injectable({ providedIn: 'root' })
export class TecnicosApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  listar(
    estado: EstadoVerificacion | null,
    pagina: number,
    tamano: number,
  ): Observable<PaginaTecnicos> {
    let params = new HttpParams().set('page', pagina).set('size', tamano);
    if (estado) {
      params = params.set('verificationStatus', estado);
    }
    return this.http.get<PaginaTecnicos>(`${this.base}/v1/admin/technicians`, { params });
  }

  /** `approve` no lleva cuerpo; `reject` exige el motivo (5 a 500 caracteres). */
  cambiarVerificacion(
    userId: string,
    accion: AccionVerificacion,
    motivo?: string,
  ): Observable<VerificacionTecnico> {
    const url = `${this.base}/v1/admin/technicians/${userId}/${accion}`;
    return this.http.post<VerificacionTecnico>(
      url,
      accion === 'approve' ? null : { reason: motivo },
    );
  }

  categorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${this.base}/v1/catalog/categories`);
  }
}
