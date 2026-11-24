import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, PendingTasks, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { API_BASE_URL } from './sesion';

/** Esquema `EncryptedPassword` (identity.v1.yaml 1.11.0). */
export interface ContrasenaCifrada {
  keyId: string;
  ciphertext: string;
}

/** Esquema `PasswordKey` (identity.v1.yaml 1.11.0). */
interface LlaveContrasena {
  keyId: string;
  algorithm: string;
  publicKey: string;
}

interface LlaveImportada {
  keyId: string;
  llave: CryptoKey;
}

function base64ABytes(texto: string): Uint8Array<ArrayBuffer> {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}

function bytesABase64Url(bytes: ArrayBuffer): string {
  let binario = '';
  for (const b of new Uint8Array(bytes)) {
    binario += String.fromCharCode(b);
  }
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Cifra la contraseña antes de enviarla (identity.v1.yaml 1.11.0), para que no se lea en la pestaña Network ni en la
 * red interna, donde VM1 ya terminó el TLS. Pide la llave pública una vez y la reutiliza; si Identity responde
 * `llave-desconocida` porque la llave cambió, pide la nueva y reintenta una sola vez.
 */
@Injectable({ providedIn: 'root' })
export class CifradoContrasena {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly tareas = inject(PendingTasks);
  private llave: Promise<LlaveImportada> | null = null;

  /**
   * Envía con la contraseña cifrada: `enviar` recibe el `encryptedPassword` que va en el cuerpo. Queda como tarea
   * pendiente de Angular mientras cifra y espera la respuesta.
   */
  async enviar<T>(
    password: string,
    enviar: (cifrada: ContrasenaCifrada) => Observable<T>,
  ): Promise<T> {
    const terminar = this.tareas.add();
    try {
      return await firstValueFrom(enviar(await this.cifrar(password)));
    } catch (e) {
      const tipo =
        e instanceof HttpErrorResponse ? ((e.error as { type?: string } | null)?.type ?? '') : '';
      if (!tipo.endsWith('/llave-desconocida')) {
        throw e;
      }
      this.llave = null;
      return await firstValueFrom(enviar(await this.cifrar(password)));
    } finally {
      terminar();
    }
  }

  private async cifrar(password: string): Promise<ContrasenaCifrada> {
    const { keyId, llave } = await this.vigente();
    const cifrado = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      llave,
      new TextEncoder().encode(password),
    );
    return { keyId, ciphertext: bytesABase64Url(cifrado) };
  }

  private vigente(): Promise<LlaveImportada> {
    this.llave ??= this.pedirLlave().catch((e: unknown) => {
      this.llave = null;
      throw e;
    });
    return this.llave;
  }

  private async pedirLlave(): Promise<LlaveImportada> {
    const r = await firstValueFrom(
      this.http.get<LlaveContrasena>(`${this.base}/v1/auth/password-key`),
    );
    const llave = await crypto.subtle.importKey(
      'spki',
      base64ABytes(r.publicKey),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    );
    return { keyId: r.keyId, llave };
  }
}
