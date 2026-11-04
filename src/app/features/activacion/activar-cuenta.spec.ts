import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { tokenDeFragmento } from './activacion-api';
import { ActivarCuenta } from './activar-cuenta';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ012-_56';
const PROBLEMA = 'https://quickpatch.internal/problems/';
const RUTA = '/api/v1/auth/password/setup';

function texto(elemento: Element | null): string {
  return (elemento?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('tokenDeFragmento', () => {
  it('lee el token de 43 caracteres base64url del fragmento', () => {
    expect(tokenDeFragmento(`token=${TOKEN}`)).toBe(TOKEN);
    expect(tokenDeFragmento(`otro=1&token=${TOKEN}`)).toBe(TOKEN);
  });

  it('rechaza un fragmento vacío o un token mal formado', () => {
    expect(tokenDeFragmento(null)).toBeNull();
    expect(tokenDeFragmento('')).toBeNull();
    expect(tokenDeFragmento('token=corto')).toBeNull();
    expect(tokenDeFragmento(`token=${TOKEN}x`)).toBeNull();
    expect(tokenDeFragmento(`token=${TOKEN.replace('a', '%')}`)).toBeNull();
  });
});

describe('ActivarCuenta (SCRUM-463)', () => {
  let http: HttpTestingController;

  function crear(fragmento: string | null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { fragment: fragmento } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(Location).go(`/activar${fragmento ? `#${fragmento}` : ''}`);
    const fixture = TestBed.createComponent(ActivarCuenta);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => http.verify());

  function escribir(fixture: ComponentFixture<ActivarCuenta>, id: string, valor: string): void {
    const input = (fixture.nativeElement as HTMLElement).querySelector(
      `#${id}`,
    ) as HTMLInputElement;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function enviar(fixture: ComponentFixture<ActivarCuenta>): void {
    ((fixture.nativeElement as HTMLElement).querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();
  }

  async function estable(fixture: ComponentFixture<ActivarCuenta>): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('muestra el formulario y quita el token de la barra de direcciones', () => {
    const { el } = crear(`token=${TOKEN}`);

    expect(texto(el.querySelector('h1'))).toBe('Activa tu cuenta');
    expect(el.querySelector('#password')).not.toBeNull();
    expect(TestBed.inject(Location).path(true)).toBe('/activar');
  });

  it('sin token o con un token mal formado muestra el enlace inválido sin formulario', () => {
    const { el } = crear('token=corto');

    expect(texto(el.querySelector('h1'))).toBe('Este enlace ya no sirve');
    expect(texto(el)).toContain('Pídele uno nuevo a tu proveedor');
    expect(el.querySelector('form')).toBeNull();
  });

  it('valida la contraseña y la confirmación antes de enviar', () => {
    const { fixture, el } = crear(`token=${TOKEN}`);

    enviar(fixture);
    expect(texto(el.querySelector('#password-error'))).toBe('Escribe tu contraseña.');
    expect(texto(el.querySelector('#confirmacion-error'))).toBe('Confirma tu contraseña.');
    expect(document.activeElement).toBe(el.querySelector('#password'));

    escribir(fixture, 'password', 'corta');
    escribir(fixture, 'confirmacion', 'otra');
    enviar(fixture);
    expect(texto(el.querySelector('#password-error'))).toBe('Usa entre 8 y 128 caracteres.');
    expect(texto(el.querySelector('#confirmacion-error'))).toBe('Las contraseñas no coinciden.');
    expect(el.querySelector('#password')?.getAttribute('aria-describedby')).toBe(
      'password-error password-ayuda',
    );

    http.expectNone(RUTA);
  });

  it('activa la cuenta con el token en el cuerpo y pide abrir la app', async () => {
    const { fixture, el } = crear(`token=${TOKEN}`);
    escribir(fixture, 'password', 'Equipo.2026');
    escribir(fixture, 'confirmacion', 'Equipo.2026');
    enviar(fixture);

    const req = http.expectOne(RUTA);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: TOKEN, password: 'Equipo.2026' });
    expect(req.request.urlWithParams).not.toContain(TOKEN);
    expect(texto(el.querySelector('button[type="submit"]'))).toBe('Activando…');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await estable(fixture);

    expect(texto(el.querySelector('h1'))).toBe('Tu cuenta quedó activa');
    expect(texto(el)).toContain('Abre la app de QUICKPATCH e inicia sesión con tu correo');
    expect(el.querySelector('[role="status"]')).not.toBeNull();
    expect(document.activeElement).toBe(el.querySelector('h1'));
  });

  it('un enlace usado, vencido o reemplazado (400) muestra el enlace inválido', async () => {
    const { fixture, el } = crear(`token=${TOKEN}`);
    escribir(fixture, 'password', 'Equipo.2026');
    escribir(fixture, 'confirmacion', 'Equipo.2026');
    enviar(fixture);
    http
      .expectOne(RUTA)
      .flush(
        { type: `${PROBLEMA}enlace-invalido`, title: 'Enlace inválido', status: 400 },
        { status: 400, statusText: 'Bad Request' },
      );
    await estable(fixture);

    expect(texto(el.querySelector('h1'))).toBe('Este enlace ya no sirve');
    expect(el.querySelector('form')).toBeNull();
  });

  it('el 400 de la contraseña queda debajo del campo y se borra al editarla', async () => {
    const { fixture, el } = crear(`token=${TOKEN}`);
    escribir(fixture, 'password', 'Equipo.2026');
    escribir(fixture, 'confirmacion', 'Equipo.2026');
    enviar(fixture);
    http.expectOne(RUTA).flush(
      {
        type: `${PROBLEMA}validacion`,
        title: 'Validación',
        status: 400,
        errors: { password: ['La contraseña es demasiado común.'] },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await estable(fixture);

    expect(texto(el.querySelector('#password-error'))).toBe('La contraseña es demasiado común.');
    expect(el.querySelector('[role="alert"]')).toBeNull();

    escribir(fixture, 'password', 'OtraClave.2026');
    expect(el.querySelector('#password-error')).toBeNull();
  });

  it('un 403, un 503 o un 400 sin campos se muestran como alerta sin perder lo escrito', async () => {
    const { fixture, el } = crear(`token=${TOKEN}`);
    escribir(fixture, 'password', 'Equipo.2026');
    escribir(fixture, 'confirmacion', 'Equipo.2026');

    enviar(fixture);
    http
      .expectOne(RUTA)
      .flush(
        { type: `${PROBLEMA}tenant-inactivo`, title: 'Inactivo', status: 403 },
        { status: 403, statusText: 'Forbidden' },
      );
    await estable(fixture);
    expect(texto(el.querySelector('[role="alert"]'))).toBe('La empresa está inactiva.');

    enviar(fixture);
    http
      .expectOne(RUTA)
      .flush(
        { type: `${PROBLEMA}canal-sin-tenant`, title: 'Sin tenant', status: 503 },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await estable(fixture);
    expect(texto(el.querySelector('[role="alert"]'))).toContain('no está disponible');

    enviar(fixture);
    http
      .expectOne(RUTA)
      .flush(
        { type: `${PROBLEMA}validacion`, title: 'Validación', status: 400, errors: {} },
        { status: 400, statusText: 'Bad Request' },
      );
    await estable(fixture);
    expect(texto(el.querySelector('[role="alert"]'))).toBe('Revisa los datos enviados.');
    expect((el.querySelector('#password') as HTMLInputElement).value).toBe('Equipo.2026');
  });
});
