import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';

import { App } from './app';
import { Sesion } from './core/sesion';
import { InicioSesion } from './features/autenticacion/inicio-sesion';
import { Inicio } from './features/inicio/inicio';
import { Tecnicos } from './features/tecnicos/tecnicos';
import { TecnicoAdmin } from './features/tecnicos/tecnicos-api';
import { Tenants } from './features/tenants/tenants';
import { Tenant } from './features/tenants/tenants-api';

/*
 * Regresión de accesibilidad (SCRUM-438): axe-core revisa cada pantalla con las reglas WCAG 2.2 A y AA (nombres
 * accesibles, etiquetas, ARIA válido, estructura de tablas y listas, ids duplicados...). El contraste no se mide aquí
 * porque jsdom no calcula estilos; lo cubre src/styles/contraste.spec.ts sobre los tokens.
 */
const REGLAS: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  rules: { 'color-contrast': { enabled: false } },
};

async function infracciones(raiz: HTMLElement): Promise<string[]> {
  const { violations } = await axe.run(raiz, REGLAS);
  return violations.map(
    (v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

const tenants: Tenant[] = [
  { id: 't1', name: 'Alfa', nit: '900', status: 'activo', createdAt: '2026-10-01T00:00:00Z' },
  { id: 't2', name: 'Beta', nit: '901', status: 'inactivo', createdAt: '2026-10-02T00:00:00Z' },
];

function boton(raiz: HTMLElement, texto: string): HTMLButtonElement {
  return Array.from(raiz.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === texto,
  ) as HTMLButtonElement;
}

describe('accesibilidad', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function crear<T>(componente: Type<T>): { fixture: ComponentFixture<T>; el: HTMLElement } {
    const fixture = TestBed.createComponent(componente);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  async function tenantsCargados(lista: Tenant[] = tenants) {
    const { fixture, el } = crear(Tenants);
    http.expectOne('/api/v1/platform/tenants').flush(lista);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el };
  }

  it('inicio de sesión, vacío y con errores de validación', async () => {
    const { fixture, el } = crear(InicioSesion);
    expect(await infracciones(el)).toEqual([]);

    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(el.querySelector('[aria-invalid="true"]')).not.toBeNull();
    expect(await infracciones(el)).toEqual([]);
  });

  it('inicio del administrador de empresa', async () => {
    const { el } = crear(Inicio);
    expect(await infracciones(el)).toEqual([]);
  });

  it('tenants mientras carga, con datos y vacío', async () => {
    const cargando = crear(Tenants);
    expect(await infracciones(cargando.el)).toEqual([]);
    http.expectOne('/api/v1/platform/tenants').flush([]);
    await cargando.fixture.whenStable();
    cargando.fixture.detectChanges();
    expect(await infracciones(cargando.el)).toEqual([]);

    const { el } = await tenantsCargados();
    expect(await infracciones(el)).toEqual([]);
  });

  it('tenants sin resultados de búsqueda', async () => {
    const { fixture, el } = await tenantsCargados();
    const busqueda = el.querySelector('input[type="search"]') as HTMLInputElement;
    busqueda.value = 'zzz';
    busqueda.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(el.textContent).toContain('Ningún tenant coincide');
    expect(await infracciones(el)).toEqual([]);
  });

  it('diálogo de confirmación abierto y con error', async () => {
    const { fixture, el } = await tenantsCargados();
    boton(el, 'Desactivar').click();
    fixture.detectChanges();
    expect(await infracciones(el)).toEqual([]);

    boton(el, 'Sí, desactivar').click();
    http
      .expectOne('/api/v1/platform/tenants/t1')
      .flush({ message: 'No disponible' }, { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('dialog [role="alert"]')).not.toBeNull();
    expect(await infracciones(el)).toEqual([]);
  });

  it('diálogo de nuevo tenant vacío y con errores por campo (SCRUM-61)', async () => {
    const { fixture, el } = await tenantsCargados();
    boton(el, 'Nuevo tenant').click();
    fixture.detectChanges();
    expect(await infracciones(el)).toEqual([]);

    boton(el, 'Crear tenant').click();
    fixture.detectChanges();
    expect(el.querySelectorAll('dialog [aria-invalid="true"]').length).toBe(2);
    expect(await infracciones(el)).toEqual([]);
  });

  it('técnicos con datos, paginación y el diálogo de motivo con error', async () => {
    const tecnicos: TecnicoAdmin[] = Array.from({ length: 20 }, (_, i) => ({
      userId: `u${i}`,
      fullName: `Técnico ${i}`,
      email: `u${i}@correo.co`,
      role: 'tecnico',
      documentId: `CC ${i}`,
      specialtyId: 'c1',
      verificationStatus: i % 2 === 0 ? 'pendiente' : 'suspendido',
      verificationReason: i % 2 === 0 ? null : 'Reclamos',
      createdAt: '2026-10-05T00:00:00Z',
    }));
    const { fixture, el } = crear(Tecnicos);
    expect(await infracciones(el)).toEqual([]);
    http.expectOne('/api/v1/catalog/categories').flush([{ id: 'c1', name: 'Plomería' }]);
    http
      .expectOne((req) => req.url === '/api/v1/admin/technicians')
      .flush({ items: tecnicos, page: 1, size: 20, totalItems: 30 });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('.paginacion')).not.toBeNull();
    expect(await infracciones(el)).toEqual([]);

    (el.querySelector('td.acciones button.peligro') as HTMLButtonElement).click();
    fixture.detectChanges();
    boton(el, 'Sí, rechazar').click();
    fixture.detectChanges();
    expect(el.querySelector('#motivo-error')).not.toBeNull();
    expect(await infracciones(el)).toEqual([]);
  });

  it('shell con sesión y con el menú deslizable abierto', async () => {
    const sesion = TestBed.inject(Sesion);
    const promesa = sesion.iniciar('admin@quickpatch.co', 'x');
    http.expectOne('/api/v1/auth/login').flush({
      accessToken: 't',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: 'u',
        email: 'admin@quickpatch.co',
        fullName: 'Laura Gómez',
        role: 'admin_plataforma',
      },
    });
    await promesa;

    const { fixture, el } = crear(App);
    expect(await infracciones(el)).toEqual([]);

    (el.querySelector('button.abrir-menu') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(await infracciones(el)).toEqual([]);
  });
});
