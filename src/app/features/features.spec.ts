import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Sesion } from '../core/sesion';
import { InicioSesion } from './autenticacion/inicio-sesion';
import { Inicio } from './inicio/inicio';
import { Tenants } from './tenants/tenants';
import { Tenant } from './tenants/tenants-api';

const tenants: Tenant[] = [
  { id: 't1', name: 'Alfa', nit: '900', status: 'activo', createdAt: '2026-10-01T00:00:00Z' },
  { id: 't2', name: 'Beta', nit: '901', status: 'inactivo', createdAt: '2026-10-02T00:00:00Z' },
];

function texto(elemento: HTMLElement): string {
  return elemento.textContent ?? '';
}

function botones(elemento: HTMLElement, etiqueta: string): HTMLButtonElement[] {
  return Array.from(elemento.querySelectorAll('button')).filter(
    (b) => texto(b).trim() === etiqueta,
  );
}

describe('features', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('Tenants', () => {
    async function crear() {
      const fixture = TestBed.createComponent(Tenants);
      fixture.detectChanges();
      http.expectOne('/api/v1/platform/tenants').flush(tenants);
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture;
    }

    it('lista los tenants con su estado', async () => {
      const fixture = await crear();
      const tabla = fixture.nativeElement as HTMLElement;

      expect(tabla.querySelectorAll('tbody tr').length).toBe(2);
      expect(texto(tabla)).toContain('Alfa');
      expect(texto(tabla)).toContain('Inactivo');
      expect(botones(tabla, 'Desactivar').length).toBe(1);
      expect(botones(tabla, 'Activar').length).toBe(1);
    });

    it('desactiva un tenant después de confirmar', async () => {
      const fixture = await crear();
      const tabla = fixture.nativeElement as HTMLElement;

      botones(tabla, 'Desactivar')[0].click();
      fixture.detectChanges();
      expect(texto(tabla)).toContain('¿Desactivar Alfa?');

      botones(tabla, 'Confirmar')[0].click();
      const req = http.expectOne('/api/v1/platform/tenants/t1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ status: 'inactivo' });
      req.flush({ ...tenants[0], status: 'inactivo' });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(botones(tabla, 'Activar').length).toBe(2);
      expect(texto(tabla)).not.toContain('¿Desactivar');
    });

    it('cancelar no llama a la API', async () => {
      const fixture = await crear();
      const tabla = fixture.nativeElement as HTMLElement;

      botones(tabla, 'Activar')[0].click();
      fixture.detectChanges();
      botones(tabla, 'Cancelar')[0].click();
      fixture.detectChanges();

      expect(texto(tabla)).not.toContain('¿Activar');
    });

    it('muestra el error del servidor', async () => {
      const fixture = await crear();
      const tabla = fixture.nativeElement as HTMLElement;

      botones(tabla, 'Desactivar')[0].click();
      fixture.detectChanges();
      botones(tabla, 'Confirmar')[0].click();
      http
        .expectOne('/api/v1/platform/tenants/t1')
        .flush(
          { type: 'https://quickpatch.internal/problems/tenant-plataforma' },
          { status: 409, statusText: 'Conflict' },
        );
      await fixture.whenStable();
      fixture.detectChanges();

      expect(tabla.querySelector('[role="alert"]')?.textContent).toContain(
        'no se puede desactivar',
      );
    });

    it('si la lista falla lo informa', async () => {
      const fixture = TestBed.createComponent(Tenants);
      fixture.detectChanges();
      http
        .expectOne('/api/v1/platform/tenants')
        .flush(
          { type: 'https://quickpatch.internal/problems/no-autorizado' },
          { status: 403, statusText: 'Forbidden' },
        );
      await fixture.whenStable();
      fixture.detectChanges();

      expect(texto(fixture.nativeElement as HTMLElement)).toContain('No tienes permiso');
    });
  });

  describe('InicioSesion', () => {
    it('valida antes de enviar', async () => {
      const fixture = TestBed.createComponent(InicioSesion);
      fixture.detectChanges();
      const pagina = fixture.nativeElement as HTMLElement;

      (pagina.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      fixture.detectChanges();

      expect(texto(pagina)).toContain('Escribe un correo válido.');
      expect(texto(pagina)).toContain('Escribe tu contraseña.');
    });

    it('entra y lleva al administrador de la plataforma a los tenants', async () => {
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const fixture = TestBed.createComponent(InicioSesion);
      fixture.detectChanges();
      const pagina = fixture.nativeElement as HTMLElement;
      const email = pagina.querySelector('#email') as HTMLInputElement;
      const password = pagina.querySelector('#password') as HTMLInputElement;
      email.value = 'plataforma@quickpatch.co';
      email.dispatchEvent(new Event('input'));
      password.value = 'secreta';
      password.dispatchEvent(new Event('input'));

      (pagina.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      http.expectOne('/api/v1/auth/login').flush({
        accessToken: 't',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: {
          id: 'u',
          email: 'plataforma@quickpatch.co',
          fullName: 'Plataforma',
          role: 'admin_plataforma',
        },
      });
      await fixture.whenStable();

      expect(navegar).toHaveBeenCalledWith(['/tenants']);
    });

    it('muestra credenciales inválidas', async () => {
      const fixture = TestBed.createComponent(InicioSesion);
      fixture.detectChanges();
      const pagina = fixture.nativeElement as HTMLElement;
      const email = pagina.querySelector('#email') as HTMLInputElement;
      const password = pagina.querySelector('#password') as HTMLInputElement;
      email.value = 'a@quickpatch.co';
      email.dispatchEvent(new Event('input'));
      password.value = 'mala';
      password.dispatchEvent(new Event('input'));

      (pagina.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      http
        .expectOne('/api/v1/auth/login')
        .flush(
          { type: 'https://quickpatch.internal/problems/credenciales-invalidas' },
          { status: 401, statusText: 'Unauthorized' },
        );
      await fixture.whenStable();
      fixture.detectChanges();

      expect(pagina.querySelector('[role="alert"]')?.textContent).toContain(
        'correo o la contraseña',
      );
    });
  });

  it('Inicio saluda al administrador del tenant', async () => {
    const sesion = TestBed.inject(Sesion);
    const promesa = sesion.iniciar('admin@quickpatch.co', 'x');
    http.expectOne('/api/v1/auth/login').flush({
      accessToken: 't',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: { id: 'u', email: 'admin@quickpatch.co', fullName: 'Ana Admin', role: 'admin_tenant' },
    });
    await promesa;

    const fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();

    expect(texto(fixture.nativeElement as HTMLElement)).toContain('Hola, Ana Admin');
  });
});
