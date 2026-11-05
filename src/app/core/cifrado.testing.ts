import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { vi } from 'vitest';

import { ContrasenaCifrada } from './cifrado';

/** Ruta de la llave pública (identity.v1.yaml 1.11.0). */
export const RUTA_LLAVE = '/api/v1/auth/password-key';
export const KEY_ID = 'llave-de-prueba';

let par: Promise<CryptoKeyPair> | null = null;

function parDeLlaves(): Promise<CryptoKeyPair> {
  par ??= crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );
  return par;
}

function base64(bytes: ArrayBuffer): string {
  let binario = '';
  for (const b of new Uint8Array(bytes)) {
    binario += String.fromCharCode(b);
  }
  return btoa(binario);
}

/** Responde las peticiones de la llave pública que haya pendientes, con una llave generada para las pruebas. */
export async function responderLlave(http: HttpTestingController, keyId = KEY_ID): Promise<void> {
  const publica = base64(await crypto.subtle.exportKey('spki', (await parDeLlaves()).publicKey));
  for (const req of http.match(RUTA_LLAVE)) {
    req.flush({ keyId, algorithm: 'RSA-OAEP-256', publicKey: publica });
  }
}

/**
 * Espera la petición a `ruta` que lleva la contraseña cifrada: primero responde la llave pública, si la pidió, y
 * después espera a que WebCrypto cifre y salga la petición.
 */
export async function esperarCifrada(
  http: HttpTestingController,
  ruta: string,
  keyId = KEY_ID,
): Promise<TestRequest> {
  let capturada: TestRequest | null = null;
  await vi.waitFor(async () => {
    await responderLlave(http, keyId);
    // match saca la petición de las pendientes; el test la responde con la que devuelve esta función.
    const pendientes = http.match(ruta);
    if (pendientes.length === 0) {
      throw new Error(`Todavía no sale ${ruta}`);
    }
    capturada = pendientes[0];
  });
  return capturada!;
}

/** Descifra el `encryptedPassword` de una petición, para comprobar qué contraseña llevaba. */
export async function contrasenaDe(req: TestRequest): Promise<string> {
  const cifrada = (req.request.body as { encryptedPassword: ContrasenaCifrada }).encryptedPassword;
  const base64Normal = cifrada.ciphertext.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64Normal + '='.repeat((4 - (base64Normal.length % 4)) % 4));
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  const plano = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    (await parDeLlaves()).privateKey,
    bytes,
  );
  return new TextDecoder().decode(plano);
}
