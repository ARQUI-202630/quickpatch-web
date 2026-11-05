import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { CifradoContrasena } from '../../core/cifrado';
import { API_BASE_URL } from '../../core/sesion';

/**
 * Token de la invitación en el fragmento del enlace (`#token=…`, identity 1.7.0): 43 caracteres base64url
 * (256 bits). Devuelve `null` si falta o no tiene esa forma.
 */
export function tokenDeFragmento(fragmento: string | null): string | null {
  const token = new URLSearchParams(fragmento ?? '').get('token');
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

/** Activación de la cuenta de un técnico del equipo de un proveedor (SCRUM-463). Sin sesión. */
@Injectable({ providedIn: 'root' })
export class ActivacionApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly cifrado = inject(CifradoContrasena);

  /**
   * `POST /v1/auth/password/setup`: el token va en el cuerpo, nunca en la URL, y la contraseña cifrada (identity
   * 1.11.0). Responde 204.
   */
  definirContrasena(token: string, password: string): Promise<void> {
    return this.cifrado.enviar(password, (encryptedPassword) =>
      this.http.post<void>(`${this.base}/v1/auth/password/setup`, { token, encryptedPassword }),
    );
  }
}
