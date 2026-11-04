import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { SolicitudRecuperacion } from './recuperacion-api';
import { Recuperaciones } from './recuperaciones';
import { RecuperarContrasena } from './recuperar-contrasena';

const TOKEN = 'Rk3pX2q9ZbT7vW1sYc8nLm4dHa6uJe0oQi5gNt-yUfB';
const PROBLEMA = 'https://quickpatch.internal/problems/';
const CONFIRMAR = '/api/v1/auth/password-recovery/confirm';
const PENDIENTES = '/api/v1/admin/password-recovery-requests';

function texto(elemento: Element | null): string {
  return (elemento?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function problema(tipo: string, status: number) {
  return [
    { type: `${PROBLEMA}${tipo}`, title: tipo, status },
    { status, statusText: 'Error' },
  ] as const;
}

describe('RecuperarContrasena (SCRUM-626)', () => {
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
    TestBed.inject(Location).go(`/recuperar${fragmento ? `#${fragmento}` : ''}`);
    const fixture = TestBed.createComponent(RecuperarContrasena);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => http.verify());

  function escribir(fixture: ComponentFixture<unknown>, id: string, valor: string): void {
    const input = (fixture.nativeElement as HTMLElement).querySelector(
      `#${id}`,
    ) as HTMLInputElement;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function enviar(fixture: ComponentFixture<unknown>): void {
    ((fixture.nativeElement as HTMLElement).querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();
  }

  function definir(fixture: ComponentFixture<unknown>, password: string): void {
    escribir(fixture, 'password', password);
    escribir(fixture, 'confirmacion', password);
    enviar(fixture);
  }

  async function estable(fixture: ComponentFixture<unknown>): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('muestra el formulario y quita el token de la barra de direcciones', () => {
    const { el } = crear(`token=${TOKEN}`);

    expect(texto(el.querySelector('h1'))).toBe('Define tu contraseña nueva');
    expect(texto(el)).toContain('vence 1 hora después de generado');
    expect(TestBed.inject(Location).path(true)).toBe('/recuperar');
  });

  it('sin token o con un token mal formado muestra el enlace inválido sin formulario', () => {
    const { el } = crear('token=corto');

    expect(texto(el.querySelector('h1'))).toBe('Este enlace ya no sirve');
    expect(texto(el)).toContain('Pídele uno nuevo al administrador');
    expect(el.querySelector('form')).toBeNull();
  });

  it('valida la contraseña y la confirmación antes de enviar', () => {
    const { fixture, el } = crear(`token=${TOKEN}`);

    enviar(fixture);
    expect(texto(el.querySelector('#password-error'))).toBe('Escribe tu contraseña nueva.');
    expect(texto(el.querySelector('#confirmacion-error'))).toBe('Confirma tu contraseña.');
    expect(document.activeElement).toBe(el.querySelector('#password'));

    escribir(fixture, 'password', 'corta');
    escribir(fixture, 'confirmacion', 'otra');
    enviar(fixture);
    expect(texto(el.querySelector('#password-error'))).toBe('Usa entre 8 y 128 caracteres.');
    expect(texto(el.querySelector('#confirmacion-error'))).toBe('Las contraseñas no coinciden.');

    http.expectNone(CONFIRMAR);
  });

  it('guarda la contraseña con el token en el cuerpo y pide entrar en la app', async () => {
    const { fixture, el } = crear(`token=${TOKEN}`);
    definir(fixture, 'Nueva.2026');

    const req = http.expectOne(CONFIRMAR);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: TOKEN, password: 'Nueva.2026' });
    expect(req.request.urlWithParams).not.toContain(TOKEN);
    expect(texto(el.querySelector('button[type="submit"]'))).toBe('Guardando…');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await estable(fixture);

    expect(texto(el.querySelector('h1'))).toBe('Tu contraseña quedó actualizada');
    expect(texto(el)).toContain('Abre la app de QUICKPATCH e inicia sesión');
    expect(el.querySelector('[role="status"]')).not.toBeNull();
    expect(document.activeElement).toBe(el.querySelector('h1'));
  });

  it('un enlace usado, vencido o anulado (400) muestra el enlace inválido', async () => {
    const { fixture, el } = crear(`token=${TOKEN}`);
    definir(fixture, 'Nueva.2026');
    http.expectOne(CONFIRMAR).flush(...problema('enlace-invalido', 400));
    await estable(fixture);

    expect(texto(el.querySelector('h1'))).toBe('Este enlace ya no sirve');
    expect(el.querySelector('form')).toBeNull();
  });

  it('el 400 de la contraseña queda debajo del campo y se borra al editarla', async () => {
    const { fixture, el } = crear(`token=${TOKEN}`);
    definir(fixture, 'Nueva.2026');
    http.expectOne(CONFIRMAR).flush(
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

  it('un 403 de tenant inactivo se muestra como alerta sin perder lo escrito', async () => {
    const { fixture, el } = crear(`token=${TOKEN}`);
    definir(fixture, 'Nueva.2026');
    http.expectOne(CONFIRMAR).flush(...problema('tenant-inactivo', 403));
    await estable(fixture);

    expect(texto(el.querySelector('[role="alert"]'))).toBe('La empresa está inactiva.');
    expect((el.querySelector('#password') as HTMLInputElement).value).toBe('Nueva.2026');
  });
});

describe('Recuperaciones (SCRUM-626)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function solicitud(
    id: string,
    extra: Partial<SolicitudRecuperacion> = {},
  ): SolicitudRecuperacion {
    return {
      id,
      userId: `u-${id}`,
      email: `${id}@correo.co`,
      fullName: `Usuario ${id}`,
      role: 'cliente',
      requestedAt: '2026-10-29T14:00:00Z',
      ...extra,
    };
  }

  function pagina(items: SolicitudRecuperacion[], total = items.length, page = 1) {
    return { items, page, size: 20, totalItems: total };
  }

  function lista() {
    return http.expectOne((req) => req.url === PENDIENTES);
  }

  function boton(el: HTMLElement, etiqueta: string): HTMLButtonElement {
    return Array.from(el.querySelectorAll('button')).find(
      (b) => texto(b) === etiqueta || b.getAttribute('aria-label') === etiqueta,
    ) as HTMLButtonElement;
  }

  async function estable(fixture: ComponentFixture<Recuperaciones>): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function cargado(items = [solicitud('a'), solicitud('b', { role: 'empresa_contacto' })]) {
    const fixture = TestBed.createComponent(Recuperaciones);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.fila-esqueleto').length).toBe(3);
    const req = lista();
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('20');
    req.flush(pagina(items));
    await estable(fixture);
    return { fixture, el };
  }

  it('lista las solicitudes pendientes con nombre, correo, rol y fecha', async () => {
    const { el } = await cargado();

    const filas = el.querySelectorAll('tbody tr');
    expect(filas.length).toBe(2);
    expect(texto(filas[0].querySelector('.nombre'))).toBe('Usuario a');
    expect(texto(filas[0].querySelector('.secundario'))).toBe('a@correo.co');
    expect(texto(filas[0].querySelector('[data-etiqueta="Rol"]'))).toBe('Cliente');
    expect(texto(filas[1].querySelector('[data-etiqueta="Rol"]'))).toBe('Contacto de empresa');
    expect(filas[0].querySelector('time')?.getAttribute('datetime')).toBe('2026-10-29T14:00:00Z');
    expect(el.querySelector('.paginacion')).toBeNull();
  });

  it('un rol desconocido se muestra tal cual', async () => {
    const { el } = await cargado([solicitud('a', { role: 'otro' })]);
    expect(texto(el.querySelector('[data-etiqueta="Rol"]'))).toBe('otro');
  });

  it('sin solicitudes lo dice', async () => {
    const { el } = await cargado([]);
    expect(texto(el.querySelector('.vacio strong'))).toBe('No hay solicitudes pendientes.');
  });

  it('si la lista falla permite reintentar sin mostrar el vacío', async () => {
    const fixture = TestBed.createComponent(Recuperaciones);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    lista().flush({}, { status: 503, statusText: 'Service Unavailable' });
    await estable(fixture);
    expect(el.querySelector('app-error-carga')).not.toBeNull();
    expect(el.querySelector('.vacio')).toBeNull();

    boton(el, 'Reintentar').click();
    lista().flush(pagina([solicitud('a')]));
    await estable(fixture);
    expect(el.querySelector('app-error-carga')).toBeNull();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('genera el enlace, lo muestra con su vencimiento y lo copia', async () => {
    const escribirPortapapeles = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: escribirPortapapeles },
      configurable: true,
    });
    const { fixture, el } = await cargado();
    const enlace = `https://quickpatch.internal/recuperar#token=${TOKEN}`;

    boton(el, 'Generar enlace para Usuario a').click();
    fixture.detectChanges();
    const req = http.expectOne(`${PENDIENTES}/a/link`);
    expect(req.request.method).toBe('POST');
    expect(texto(el.querySelector('td.acciones button'))).toBe('Generando…');
    expect(boton(el, 'Generar enlace para Usuario b').disabled).toBe(true);
    req.flush({ link: enlace, token: TOKEN, expiresAt: '2026-10-29T15:00:00Z' });
    await estable(fixture);

    expect(texto(el.querySelector('#titulo-enlace'))).toBe('Enlace para Usuario a');
    expect((el.querySelector('#enlace') as HTMLInputElement).value).toBe(enlace);
    expect(el.querySelector('.enlace-generado time')?.getAttribute('datetime')).toBe(
      '2026-10-29T15:00:00Z',
    );
    expect(texto(el.querySelector('.enlace-generado'))).toContain('Sirve una sola vez');

    boton(el, 'Copiar enlace').click();
    await estable(fixture);
    expect(escribirPortapapeles).toHaveBeenCalledWith(enlace);
    expect(texto(el.querySelector('[role="status"]'))).toBe('Enlace copiado.');

    escribirPortapapeles.mockRejectedValueOnce(new Error('denegado'));
    boton(el, 'Copiar enlace').click();
    await estable(fixture);
    expect(texto(el.querySelector('[role="status"]'))).toContain('No se pudo copiar el enlace');

    boton(el, 'Listo').click();
    fixture.detectChanges();
    expect(el.querySelector('.enlace-generado')).toBeNull();
    expect(texto(el.querySelector('[role="status"]'))).toBe('');
  });

  it('si el usuario ya cambió su contraseña (409) lo dice y recarga la lista', async () => {
    const { fixture, el } = await cargado();

    boton(el, 'Generar enlace para Usuario a').click();
    http.expectOne(`${PENDIENTES}/a/link`).flush(...problema('transicion-invalida', 409));
    await estable(fixture);

    expect(texto(el.querySelector('.alerta'))).toBe(
      'Usuario a ya definió su contraseña nueva; la solicitud se cerró.',
    );
    lista().flush(pagina([solicitud('b')]));
    await estable(fixture);
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.querySelector('.enlace-generado')).toBeNull();
  });

  it('si la solicitud ya no existe (404) lo dice y recarga la lista', async () => {
    const { fixture, el } = await cargado();

    boton(el, 'Generar enlace para Usuario b').click();
    http.expectOne(`${PENDIENTES}/b/link`).flush(...problema('no-encontrado', 404));
    await estable(fixture);

    expect(texto(el.querySelector('.alerta'))).toBe(
      'Esa solicitud ya no existe. Revisa la lista actualizada.',
    );
    lista().flush(pagina([solicitud('a')]));
    await estable(fixture);
  });

  it('otro error al generar se muestra sin recargar', async () => {
    const { fixture, el } = await cargado();

    boton(el, 'Generar enlace para Usuario a').click();
    http
      .expectOne(`${PENDIENTES}/a/link`)
      .flush({}, { status: 503, statusText: 'Service Unavailable' });
    await estable(fixture);

    expect(texto(el.querySelector('.alerta'))).toBe('Ocurrió un error inesperado.');
    http.expectNone((req) => req.url === PENDIENTES);
  });

  it('pagina y vuelve a la anterior si la última quedó vacía', async () => {
    const veinte = Array.from({ length: 20 }, (_, i) => solicitud(`s${i}`));
    const fixture = TestBed.createComponent(Recuperaciones);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    lista().flush(pagina(veinte, 21));
    await estable(fixture);
    expect(texto(el.querySelector('.paginacion .numerico'))).toBe('1–20 de 21');

    boton(el, 'Siguiente').click();
    const segunda = lista();
    expect(segunda.request.params.get('page')).toBe('2');
    segunda.flush(pagina([], 20, 2));
    await fixture.whenStable();
    const primera = lista();
    expect(primera.request.params.get('page')).toBe('1');
    primera.flush(pagina(veinte, 20));
    await estable(fixture);
    expect(el.querySelector('.paginacion')).toBeNull();
  });

  it('desde la segunda página vuelve con Anterior', async () => {
    const veinte = Array.from({ length: 20 }, (_, i) => solicitud(`s${i}`));
    const fixture = TestBed.createComponent(Recuperaciones);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    lista().flush(pagina(veinte, 25));
    await estable(fixture);

    boton(el, 'Siguiente').click();
    lista().flush(pagina([solicitud('x')], 25, 2));
    await estable(fixture);
    expect(texto(el.querySelector('.paginacion .numerico'))).toBe('21–21 de 25');

    boton(el, 'Anterior').click();
    expect(lista().request.params.get('page')).toBe('1');
  });
});
