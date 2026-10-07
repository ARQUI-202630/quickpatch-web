import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { redirigirPorRol, requiereRol } from './guards';
import { autenticacionInterceptor, correlacionInterceptor, mensajeDeError } from './http';
import { RolSinAccesoError, Sesion } from './sesion';

function respuestaLogin(role: string, expiresIn = 3600) {
  return {
    accessToken: 'token-' + role,
    tokenType: 'Bearer',
    expiresIn,
    user: { id: 'u1', email: 'admin@quickpatch.co', fullName: 'Ana Admin', role },
  };
}

describe('core', () => {
  let sesion: Sesion;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([correlacionInterceptor, autenticacionInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    sesion = TestBed.inject(Sesion);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  async function iniciarComo(role: string, expiresIn = 3600) {
    const promesa = sesion.iniciar(' admin@quickpatch.co ', 'secreta');
    const req = http.expectOne('/api/v1/auth/login');
    expect(req.request.body).toEqual({ email: 'admin@quickpatch.co', password: 'secreta' });
    expect(req.request.headers.has('X-Correlation-Id')).toBe(true);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(respuestaLogin(role, expiresIn));
    return promesa;
  }

  it('inicia sesión como administrador y la guarda en sessionStorage', async () => {
    const usuario = await iniciarComo('admin_plataforma');

    expect(usuario.role).toBe('admin_plataforma');
    expect(sesion.autenticado()).toBe(true);
    expect(sesion.token()).toBe('token-admin_plataforma');
    expect(sesion.tieneRol('admin_plataforma')).toBe(true);
    expect(sesion.tieneRol('admin_tenant')).toBe(false);
    expect(sessionStorage.getItem('quickpatch.sesion')).toContain('token-admin_plataforma');
  });

  it('rechaza los roles de la app móvil', async () => {
    await expect(iniciarComo('cliente')).rejects.toBeInstanceOf(RolSinAccesoError);
    expect(sesion.autenticado()).toBe(false);
  });

  it('una sesión vencida no cuenta y cerrar la borra', async () => {
    await iniciarComo('admin_tenant', -1);
    expect(sesion.autenticado()).toBe(false);
    expect(sesion.token()).toBeNull();

    sesion.cerrar();
    expect(sessionStorage.getItem('quickpatch.sesion')).toBeNull();
    expect(sesion.usuario()).toBeNull();
  });

  it('agrega el token a la API y no a otros orígenes', async () => {
    await iniciarComo('admin_tenant');
    const cliente = TestBed.inject(HttpClient);

    void firstValueFrom(cliente.get('/api/v1/users/me'));
    void firstValueFrom(cliente.get('https://otro.sitio/recurso'));

    const api = http.expectOne('/api/v1/users/me');
    expect(api.request.headers.get('Authorization')).toBe('Bearer token-admin_tenant');
    api.flush({});
    const externo = http.expectOne('https://otro.sitio/recurso');
    expect(externo.request.headers.has('Authorization')).toBe(false);
    expect(externo.request.headers.has('X-Correlation-Id')).toBe(false);
    externo.flush({});
  });

  it('un 401 con sesión la cierra y lleva al inicio de sesión', async () => {
    await iniciarComo('admin_tenant');
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const llamada = firstValueFrom(TestBed.inject(HttpClient).get('/api/v1/users/me'));
    http.expectOne('/api/v1/users/me').flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(llamada).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(sesion.autenticado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/iniciar-sesion']);
  });

  it('traduce los errores de la API', () => {
    const problema = (status: number, slug: string) =>
      new HttpErrorResponse({
        status,
        error: { type: `https://quickpatch.internal/problems/${slug}` },
      });

    expect(mensajeDeError(problema(401, 'credenciales-invalidas'))).toContain(
      'correo o la contraseña',
    );
    expect(mensajeDeError(problema(409, 'tenant-plataforma'))).toContain('no se puede desactivar');
    expect(mensajeDeError(problema(500, 'otro'))).toBe('Ocurrió un error inesperado.');
    expect(mensajeDeError(new HttpErrorResponse({ status: 0 }))).toContain('conexión');
    expect(mensajeDeError(new RolSinAccesoError())).toContain('app móvil');
    expect(mensajeDeError('raro')).toBe('Ocurrió un error inesperado.');
  });

  it('los guards exigen sesión y rol', async () => {
    const ejecutar = (guard: ReturnType<typeof requiereRol>) =>
      TestBed.runInInjectionContext(() => guard({} as never, {} as never)) as UrlTree | boolean;

    expect((ejecutar(requiereRol('admin_plataforma')) as UrlTree).toString()).toBe(
      '/iniciar-sesion',
    );
    expect((ejecutar(redirigirPorRol) as UrlTree).toString()).toBe('/iniciar-sesion');

    await iniciarComo('admin_tenant');
    expect((ejecutar(requiereRol('admin_plataforma')) as UrlTree).toString()).toBe('/inicio');
    expect(ejecutar(requiereRol('admin_tenant'))).toBe(true);
    expect((ejecutar(redirigirPorRol) as UrlTree).toString()).toBe('/inicio');

    sesion.cerrar();
    await iniciarComo('admin_plataforma');
    expect((ejecutar(redirigirPorRol) as UrlTree).toString()).toBe('/tenants');
  });
});
