import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Tenants } from './tenants';
import { Tenant } from './tenants-api';

const PROBLEMA = 'https://quickpatch.internal/problems/';

const tenants: Tenant[] = [
  { id: 't1', name: 'Alfa', nit: '900', status: 'activo', createdAt: '2026-10-01T00:00:00Z' },
  { id: 't2', name: 'Beta', nit: '901', status: 'inactivo', createdAt: '2026-10-02T00:00:00Z' },
];

const creado: Tenant = {
  id: 't3',
  name: 'Servicios Andinos',
  nit: '900123456-7',
  status: 'activo',
  createdAt: '2026-10-14T00:00:00Z',
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

describe('Tenants: crear tenant (SCRUM-61)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function estable(fixture: ComponentFixture<Tenants>): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function abrir(lista: Tenant[] = tenants) {
    const fixture = TestBed.createComponent(Tenants);
    fixture.detectChanges();
    http.expectOne('/api/v1/platform/tenants').flush(lista);
    await estable(fixture);
    const el = fixture.nativeElement as HTMLElement;
    boton(el, 'Nuevo tenant').click();
    fixture.detectChanges();
    return { fixture, el };
  }

  function campo(el: HTMLElement, id: 'tenant-nombre' | 'tenant-nit'): HTMLInputElement {
    return el.querySelector(`#${id}`) as HTMLInputElement;
  }

  function escribir(
    fixture: ComponentFixture<Tenants>,
    id: 'tenant-nombre' | 'tenant-nit',
    valor: string,
  ): void {
    const input = campo(fixture.nativeElement as HTMLElement, id);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function dialogo(el: HTMLElement): HTMLDialogElement {
    return Array.from(el.querySelectorAll('dialog')).find((d) =>
      texto(d).includes('Nuevo tenant'),
    ) as HTMLDialogElement;
  }

  function errorDe(el: HTMLElement, id: 'tenant-nombre' | 'tenant-nit'): string {
    return texto(el.querySelector(`#${id}-error`)).trim();
  }

  it('abre el diálogo vacío, sin errores, y explica que nace activo', async () => {
    const { el } = await abrir();

    expect(dialogo(el).hasAttribute('open')).toBe(true);
    expect(texto(dialogo(el))).toContain('Se crea activo');
    expect(campo(el, 'tenant-nombre').value).toBe('');
    expect(el.querySelector('[aria-invalid="true"]')).toBeNull();
    expect(texto(el.querySelector('#tenant-nombre-cuenta'))).toContain('0/150');
  });

  it('valida los campos en la página y no envía si son inválidos', async () => {
    const { fixture, el } = await abrir();

    boton(el, 'Crear tenant').click();
    fixture.detectChanges();
    expect(errorDe(el, 'tenant-nombre')).toBe('Escribe el nombre de la empresa.');
    expect(errorDe(el, 'tenant-nit')).toBe('Escribe el NIT.');
    expect(document.activeElement).toBe(campo(el, 'tenant-nombre'));

    escribir(fixture, 'tenant-nombre', ' A ');
    escribir(fixture, 'tenant-nit', '9001-23');
    boton(el, 'Crear tenant').click();
    fixture.detectChanges();
    expect(errorDe(el, 'tenant-nombre')).toBe('El nombre debe tener entre 2 y 150 caracteres.');
    expect(errorDe(el, 'tenant-nit')).toContain('solo dígitos');
    expect(campo(el, 'tenant-nit').getAttribute('aria-describedby')).toBe(
      'tenant-nit-error tenant-nit-ayuda',
    );

    escribir(fixture, 'tenant-nombre', 'Alfa Dos');
    escribir(fixture, 'tenant-nit', '9001');
    boton(el, 'Crear tenant').click();
    fixture.detectChanges();
    expect(errorDe(el, 'tenant-nombre')).toBe('');
    expect(errorDe(el, 'tenant-nit')).toBe('El NIT debe tener entre 5 y 30 caracteres.');
    expect(document.activeElement).toBe(campo(el, 'tenant-nit'));

    http.expectNone('/api/v1/platform/tenants');
  });

  it('crea el tenant sin espacios sobrantes, lo pone arriba y avisa', async () => {
    const { fixture, el } = await abrir();

    escribir(fixture, 'tenant-nombre', '  Servicios Andinos ');
    escribir(fixture, 'tenant-nit', ' 900123456-7 ');
    expect(texto(el.querySelector('#tenant-nombre-cuenta'))).toContain('17/150');
    boton(el, 'Crear tenant').click();
    fixture.detectChanges();

    const req = http.expectOne('/api/v1/platform/tenants');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Servicios Andinos', nit: '900123456-7' });
    expect(texto(boton(el, 'Guardando…'))).toContain('Guardando');
    req.flush(creado, { status: 201, statusText: 'Created' });
    await estable(fixture);

    expect(dialogo(el).hasAttribute('open')).toBe(false);
    const filas = el.querySelectorAll('tbody tr');
    expect(filas.length).toBe(3);
    expect(texto(filas[0])).toContain('Servicios Andinos');
    expect(texto(el.querySelector('.resumen'))).toContain('2 activos');
    expect(texto(el.querySelector('.aviso'))).toBe('Tenant «Servicios Andinos» creado.');
  });

  it('Enter en un campo envía el formulario', async () => {
    const { fixture, el } = await abrir();

    escribir(fixture, 'tenant-nombre', 'Servicios Andinos');
    escribir(fixture, 'tenant-nit', '900123456-7');
    campo(el, 'tenant-nit').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    fixture.detectChanges();

    http
      .expectOne('/api/v1/platform/tenants')
      .flush(creado, { status: 201, statusText: 'Created' });
    await estable(fixture);
    expect(dialogo(el).hasAttribute('open')).toBe(false);
  });

  it('un NIT repetido (409) se muestra en su campo y se borra al corregirlo', async () => {
    const { fixture, el } = await abrir();

    escribir(fixture, 'tenant-nombre', 'Alfa Dos');
    escribir(fixture, 'tenant-nit', '900123456-7');
    boton(el, 'Crear tenant').click();
    http
      .expectOne('/api/v1/platform/tenants')
      .flush(
        { type: `${PROBLEMA}nit-registrado`, title: 'NIT registrado', status: 409 },
        { status: 409, statusText: 'Conflict' },
      );
    await estable(fixture);

    expect(dialogo(el).hasAttribute('open')).toBe(true);
    expect(errorDe(el, 'tenant-nit')).toBe('Ya existe un tenant con ese NIT.');
    expect(campo(el, 'tenant-nit').getAttribute('aria-invalid')).toBe('true');
    expect(campo(el, 'tenant-nombre').value).toBe('Alfa Dos');
    expect(dialogo(el).querySelector('[role="alert"]')).toBeNull();

    escribir(fixture, 'tenant-nit', '900123457');
    expect(errorDe(el, 'tenant-nit')).toBe('');
  });

  it('los errores por campo del 400 quedan debajo de cada campo', async () => {
    const { fixture, el } = await abrir();

    escribir(fixture, 'tenant-nombre', 'Alfa Dos');
    escribir(fixture, 'tenant-nit', '900123456');
    boton(el, 'Crear tenant').click();
    http.expectOne('/api/v1/platform/tenants').flush(
      {
        type: `${PROBLEMA}validacion`,
        title: 'Validación',
        status: 400,
        errors: { name: ['Nombre del servidor.'], nit: ['NIT del servidor.'], otro: [] },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await estable(fixture);

    expect(errorDe(el, 'tenant-nombre')).toBe('Nombre del servidor.');
    expect(errorDe(el, 'tenant-nit')).toBe('NIT del servidor.');
    expect(document.activeElement).toBe(campo(el, 'tenant-nombre'));
  });

  it('un 400 sin campos conocidos u otro error se muestra como alerta sin perder lo escrito', async () => {
    const { fixture, el } = await abrir();

    escribir(fixture, 'tenant-nombre', 'Alfa Dos');
    escribir(fixture, 'tenant-nit', '900123456');
    boton(el, 'Crear tenant').click();
    http
      .expectOne('/api/v1/platform/tenants')
      .flush(
        { type: `${PROBLEMA}validacion`, title: 'Validación', status: 400, errors: {} },
        { status: 400, statusText: 'Bad Request' },
      );
    await estable(fixture);
    expect(texto(dialogo(el).querySelector('[role="alert"]'))).toBe('Revisa los datos enviados.');

    boton(el, 'Crear tenant').click();
    http
      .expectOne('/api/v1/platform/tenants')
      .flush(
        { type: `${PROBLEMA}no-autorizado`, title: 'Prohibido', status: 403 },
        { status: 403, statusText: 'Forbidden' },
      );
    await estable(fixture);
    expect(texto(dialogo(el).querySelector('[role="alert"]'))).toBe(
      'No tienes permiso para hacer esta acción.',
    );
    expect(campo(el, 'tenant-nit').value).toBe('900123456');
    // La alerta del diálogo no se repite fuera de él.
    expect(el.querySelectorAll('[role="alert"]').length).toBe(1);
  });

  it('cancelar cierra sin enviar y al volver a abrir el formulario está limpio', async () => {
    const { fixture, el } = await abrir();

    escribir(fixture, 'tenant-nombre', 'A');
    boton(dialogo(el), 'Cancelar').click();
    fixture.detectChanges();
    expect(dialogo(el).hasAttribute('open')).toBe(false);

    boton(el, 'Nuevo tenant').click();
    fixture.detectChanges();
    expect(campo(el, 'tenant-nombre').value).toBe('');
    expect(errorDe(el, 'tenant-nombre')).toBe('');
  });

  it('sin tenants invita a crear el primero', async () => {
    const fixture = TestBed.createComponent(Tenants);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(boton(el, 'Nuevo tenant').disabled).toBe(true);
    http.expectOne('/api/v1/platform/tenants').flush([]);
    await estable(fixture);

    expect(texto(el)).toContain('Crea la primera empresa oferente con «Nuevo tenant».');
    expect(boton(el, 'Nuevo tenant').disabled).toBe(false);
  });
});
