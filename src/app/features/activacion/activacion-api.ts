import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { CifradoContrasena } from '../../core/cifrado';
import { API_BASE_URL } from '../../core/sesion';

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
