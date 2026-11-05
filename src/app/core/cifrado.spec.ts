import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CifradoContrasena } from './cifrado';
import { KEY_ID, RUTA_LLAVE, contrasenaDe, esperarCifrada } from './cifrado.testing';

const RUTA = '/api/v1/auth/login';

describe('CifradoContrasena (identity 1.11.0)', () => {
  let cifrado: CifradoContrasena;
  let http: HttpTestingController;
  let cliente: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    cifrado = TestBed.inject(CifradoContrasena);
    http = TestBed.inject(HttpTestingController);
    cliente = TestBed.inject(HttpClient);
  });

  afterEach(() => http.verify());

  const enviar = (password: string) =>
    cifrado.enviar(password, (encryptedPassword) =>
      cliente.post<{ ok: boolean }>(RUTA, { encryptedPassword }),
    );

  it('cifra con la llave pública y nunca manda la contraseña en claro', async () => {
    const promesa = enviar('Clave.ñ2026');
    const req = await esperarCifrada(http, RUTA);

    expect(req.request.body.password).toBeUndefined();
    expect(req.request.body.encryptedPassword.keyId).toBe(KEY_ID);
    expect(req.request.body.encryptedPassword.ciphertext).not.toContain('Clave');
    expect(await contrasenaDe(req)).toBe('Clave.ñ2026');
    req.flush({ ok: true });
    await expect(promesa).resolves.toEqual({ ok: true });
  });

  it('pide la llave una sola vez para varios envíos', async () => {
    const primero = enviar('Uno.2026');
    (await esperarCifrada(http, RUTA)).flush({ ok: true });
    await primero;

    const segundo = enviar('Dos.2026');
    const req = await esperarCifrada(http, RUTA);
    http.expectNone(RUTA_LLAVE);
    expect(await contrasenaDe(req)).toBe('Dos.2026');
    req.flush({ ok: true });
    await segundo;
  });

  it('con llave-desconocida pide la llave de nuevo y reintenta una vez', async () => {
    const promesa = enviar('Clave.2026');
    (await esperarCifrada(http, RUTA, 'vieja')).flush(
      { type: 'https://quickpatch.internal/problems/llave-desconocida', status: 400 },
      { status: 400, statusText: 'Bad Request' },
    );

    const reintento = await esperarCifrada(http, RUTA, 'nueva');
    expect(reintento.request.body.encryptedPassword.keyId).toBe('nueva');
    reintento.flush({ ok: true });
    await expect(promesa).resolves.toEqual({ ok: true });
  });

  it('otros errores no se reintentan', async () => {
    const promesa = enviar('Clave.2026');
    (await esperarCifrada(http, RUTA)).flush(
      { type: 'https://quickpatch.internal/problems/credenciales-invalidas', status: 401 },
      { status: 401, statusText: 'Unauthorized' },
    );

    await expect(promesa).rejects.toMatchObject({ status: 401 });
  });
});
