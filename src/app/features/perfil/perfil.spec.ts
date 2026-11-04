import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { Sesion } from '../../core/sesion';
import { MiPerfil } from './perfil';
import { Perfil } from './perfil-api';

const PROBLEMA = 'https://quickpatch.internal/problems/';

const perfil: Perfil = {
  id: 'u1',
  email: 'laura@andinos.co',
  fullName: 'Laura Méndez',
  role: 'admin_tenant',
  phone: '3001234567',
};

@Component({ template: '<p>Otra página</p>' })
class OtraPagina {}

/** La ruta real de app.routes.ts, con la página ya cargada para no esperar la carga diferida. */
const rutaPerfil: Route = {
  ...(routes.find((r) => r.path === 'perfil') as Route),
  loadComponent: undefined,
  component: MiPerfil,
};

function texto(elemento: Element | null): string {
  return elemento?.textContent ?? '';
}

function boton(elemento: HTMLElement, etiqueta: string): HTMLButtonElement {
  const encontrado = Array.from(elemento.querySelectorAll('button')).find(
    (b) => texto(b).trim() === etiqueta,
  );
  if (!encontrado) {
    throw new Error(`No hay botón «${etiqueta}»`);
  }
  return encontrado;
}

describe('Mi perfil (SCRUM-613)', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    sessionStorage.clear();
    sessionStorage.setItem(
      'quickpatch.sesion',
      JSON.stringify({
        token: 'token-admin',
        venceEn: Date.now() + 3_600_000,
        usuario: { id: 'u1', email: perfil.email, fullName: perfil.fullName, role: 'admin_tenant' },
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'otra', component: OtraPagina },
          { path: 'inicio', component: OtraPagina },
          // La raíz real: con sesión, su guard lleva al inicio del rol.
          {
            ...(routes.find((r) => r.path === '') as Route),
            loadComponent: undefined,
            component: OtraPagina,
          },
          rutaPerfil,
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  function el(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  async function abrir(respuesta: Perfil = perfil): Promise<MiPerfil> {
    const componente = await harness.navigateByUrl('/perfil', MiPerfil);
    const req = http.expectOne('/api/v1/users/me');
    expect(req.request.method).toBe('GET');
    req.flush(respuesta);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return componente;
  }

  function campo(id: 'perfil-nombre' | 'perfil-telefono'): HTMLInputElement {
    return el().querySelector(`#${id}`) as HTMLInputElement;
  }

  function escribir(id: 'perfil-nombre' | 'perfil-telefono', valor: string): void {
    const input = campo(id);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    harness.detectChanges();
  }

  async function guardar(): Promise<void> {
    boton(el(), 'Guardar cambios').click();
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  async function pausa(): Promise<void> {
    await new Promise((r) => setTimeout(r));
    harness.detectChanges();
  }

  async function estable(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  it('muestra el correo y el rol sin editar y el formulario con los datos', async () => {
    await abrir();

    expect(texto(el().querySelector('h2'))).toBe('Mi perfil');
    expect(texto(el().querySelector('.fijos'))).toContain('laura@andinos.co');
    expect(texto(el().querySelector('.fijos'))).toContain('Administrador de empresa');
    expect(texto(el().querySelector('.fijos'))).toContain('(no se puede cambiar)');
    expect(el().querySelector('#perfil-correo, input[type="email"]')).toBeNull();
    expect(campo('perfil-nombre').value).toBe('Laura Méndez');
    expect(campo('perfil-telefono').value).toBe('3001234567');
    // Sin cambios no se puede guardar.
    expect(boton(el(), 'Guardar cambios').disabled).toBe(true);
    expect(boton(el(), 'Volver')).toBeTruthy();
  });

  it('mientras carga lo anuncia y si falla ofrece reintentar', async () => {
    await harness.navigateByUrl('/perfil', MiPerfil);
    harness.detectChanges();
    expect(texto(el())).toContain('Cargando tu perfil…');
    expect(el().querySelector('.tarjeta')?.getAttribute('aria-busy')).toBe('true');

    http
      .expectOne('/api/v1/users/me')
      .flush(
        { type: PROBLEMA + 'canal-sin-tenant', status: 503 },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await estable();
    expect(texto(el().querySelector('[role="alert"]'))).toContain('El servicio no está disponible');

    boton(el(), 'Reintentar').click();
    http.expectOne('/api/v1/users/me').flush(perfil);
    await estable();
    expect(campo('perfil-nombre').value).toBe('Laura Méndez');
  });

  it('valida el nombre y el teléfono antes de enviar', async () => {
    await abrir();

    escribir('perfil-nombre', 'L');
    escribir('perfil-telefono', '123');
    await guardar();

    expect(texto(el().querySelector('#perfil-nombre-error'))).toContain('entre 2 y 150');
    expect(texto(el().querySelector('#perfil-telefono-error'))).toContain('entre 7 y 30');
    expect(campo('perfil-nombre').getAttribute('aria-invalid')).toBe('true');
    expect(campo('perfil-nombre').getAttribute('aria-describedby')).toBe('perfil-nombre-error');
    expect(document.activeElement).toBe(campo('perfil-nombre'));

    escribir('perfil-nombre', '   ');
    expect(texto(el().querySelector('#perfil-nombre-error'))).toBe('Escribe tu nombre.');
    http.expectNone('/api/v1/users/me');
  });

  it('guarda solo el nombre y lo muestra en la sesión sin volver a iniciar sesión', async () => {
    await abrir();

    escribir('perfil-nombre', '  Laura Méndez Ruiz ');
    await guardar();

    const req = http.expectOne('/api/v1/users/me');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ fullName: 'Laura Méndez Ruiz' });
    req.flush({ ...perfil, fullName: 'Laura Méndez Ruiz' });
    await estable();

    expect(texto(el().querySelector('[role="status"]'))).toBe('Perfil actualizado.');
    expect(campo('perfil-nombre').value).toBe('Laura Méndez Ruiz');
    expect(boton(el(), 'Guardar cambios').disabled).toBe(true);
    expect(TestBed.inject(Sesion).usuario()?.fullName).toBe('Laura Méndez Ruiz');
  });

  it('borrar el teléfono envía phone en null', async () => {
    await abrir();

    escribir('perfil-telefono', '');
    await guardar();

    const req = http.expectOne('/api/v1/users/me');
    expect(req.request.body).toEqual({ phone: null });
    req.flush({ ...perfil, phone: null });
    await estable();
    expect(campo('perfil-telefono').value).toBe('');
  });

  it('pone los errores del 400 en su campo y los borra al editar', async () => {
    await abrir();

    escribir('perfil-nombre', 'Laura M.');
    escribir('perfil-telefono', '3009999999');
    await guardar();
    http.expectOne('/api/v1/users/me').flush(
      {
        type: PROBLEMA + 'validacion',
        status: 400,
        errors: { fullName: ['El nombre no es válido.'], phone: ['El teléfono no es válido.'] },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await estable();

    expect(texto(el().querySelector('#perfil-nombre-error'))).toBe('El nombre no es válido.');
    expect(texto(el().querySelector('#perfil-telefono-error'))).toBe('El teléfono no es válido.');
    expect(el().querySelector('.alerta')).toBeNull();

    escribir('perfil-nombre', 'Laura Mé');
    expect(el().querySelector('#perfil-nombre-error')).toBeNull();
    expect(texto(el().querySelector('#perfil-telefono-error'))).toBe('El teléfono no es válido.');
  });

  it('un error sin campos se muestra en el aviso sin perder lo escrito', async () => {
    await abrir();

    escribir('perfil-nombre', 'Laura Ruiz');
    await guardar();
    http
      .expectOne('/api/v1/users/me')
      .flush(
        { type: PROBLEMA + 'no-autorizado', status: 403 },
        { status: 403, statusText: 'Forbidden' },
      );
    await estable();

    expect(texto(el().querySelector('.alerta'))).toContain('No tienes permiso');
    expect(campo('perfil-nombre').value).toBe('Laura Ruiz');
  });

  it('salir con cambios pide confirmación', async () => {
    await abrir();
    const router = TestBed.inject(Router);

    escribir('perfil-nombre', 'Otro nombre');
    const salida = router.navigateByUrl('/otra');
    // Mientras el diálogo espera, la navegación sigue pendiente: no se espera a que la app quede estable.
    await pausa();
    expect(texto(document.querySelector('dialog[open] h2'))).toBe('¿Salir sin guardar?');

    boton(document.querySelector('dialog') as HTMLElement, 'Seguir aquí').click();
    expect(await salida).toBe(false);
    await estable();
    expect(router.url).toBe('/perfil');
    expect(campo('perfil-nombre').value).toBe('Otro nombre');

    const otra = router.navigateByUrl('/otra');
    await pausa();
    boton(document.querySelector('dialog') as HTMLElement, 'Salir').click();
    expect(await otra).toBe(true);
    expect(router.url).toBe('/otra');
  });

  it('salir sin cambios no pregunta', async () => {
    const pagina = await abrir();

    expect(pagina.puedeSalir()).toBe(true);
    expect(await TestBed.inject(Router).navigateByUrl('/otra')).toBe(true);
  });

  it('Volver regresa a la página anterior o, sin historial, al inicio del rol', async () => {
    await abrir();
    boton(el(), 'Volver').click();
    await estable();
    // Se entró directo a /perfil: va a la raíz, que lleva al inicio del administrador.
    expect(TestBed.inject(Router).url).toBe('/inicio');
  });
});
