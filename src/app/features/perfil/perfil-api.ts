import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../core/sesion';

/** Esquema `UserProfile` (identity.v1.yaml 1.9.0). */
export interface Perfil {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone?: string | null;
}

/** Cuerpo de `PATCH /v1/users/me`: solo los campos que cambian; `phone: null` borra el teléfono. */
export interface CambiosPerfil {
  fullName?: string;
  phone?: string | null;
}

/**
 * Perfil propio (SCRUM-609 / SCRUM-613). La ruta no lleva el usuario ni el tenant: salen del token. El correo, el rol,
 * el tenant y el estado de verificación no se editan.
 */
@Injectable({ providedIn: 'root' })
export class PerfilApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  obtener(): Observable<Perfil> {
    return this.http.get<Perfil>(`${this.base}/v1/users/me`);
  }

  /** `400` trae los errores por campo (`fullName`, `phone`). */
  actualizar(cambios: CambiosPerfil): Observable<Perfil> {
    return this.http.patch<Perfil>(`${this.base}/v1/users/me`, cambios);
  }
}
