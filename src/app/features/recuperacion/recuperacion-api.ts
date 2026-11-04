import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../core/sesion';

/** Esquema `PasswordRecoveryPending` (identity.v1.yaml 1.10.0). No lleva ningún token. */
export interface SolicitudRecuperacion {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: string;
  /** Última vez que el usuario la pidió. */
  requestedAt: string;
}

/** Esquema `PasswordRecoveryRequestPage`. */
export interface PaginaRecuperaciones {
  items: SolicitudRecuperacion[];
  page: number;
  size: number;
  totalItems: number;
}

/** Esquema `Invitation`: el mismo formato del enlace de invitación. */
export interface EnlaceRecuperacion {
  link: string;
  token: string;
  expiresAt: string;
}

/**
 * Recuperación de la contraseña olvidada (SCRUM-626, identity 1.10.0). El correo sigue fuera del MVP (ADR-024): el
 * usuario la pide desde la app, el `admin_tenant` genera aquí un enlace de un solo uso que vence en 1 hora y se lo
 * entrega, y el usuario define la contraseña nueva en la página pública `/recuperar`. El tenant sale del token o del
 * canal: la UI nunca lo envía.
 */
@Injectable({ providedIn: 'root' })
export class RecuperacionApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  /** `GET /v1/admin/password-recovery-requests`: pendientes del tenant, de la más antigua a la más reciente. */
  pendientes(pagina: number, tamano: number): Observable<PaginaRecuperaciones> {
    const params = new HttpParams().set('page', pagina).set('size', tamano);
    return this.http.get<PaginaRecuperaciones>(`${this.base}/v1/admin/password-recovery-requests`, {
      params,
    });
  }

  /** `POST …/{id}/link`: enlace nuevo; anula los anteriores del usuario. Solo se muestra en esta respuesta. */
  generarEnlace(id: string): Observable<EnlaceRecuperacion> {
    return this.http.post<EnlaceRecuperacion>(
      `${this.base}/v1/admin/password-recovery-requests/${id}/link`,
      null,
    );
  }

  /** `POST /v1/auth/password-recovery/confirm`: sin sesión; el token va en el cuerpo, nunca en la URL. 204. */
  confirmar(token: string, password: string): Observable<void> {
    return this.http.post<void>(`${this.base}/v1/auth/password-recovery/confirm`, {
      token,
      password,
    });
  }
}
