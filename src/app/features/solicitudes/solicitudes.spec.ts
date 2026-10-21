import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Sesion } from '../../core/sesion';
import { ESTADOS_SOLICITUD } from '../../shared/estado-solicitud';
import { INTERVALO_ACTUALIZACION_MS } from './actualizacion';
import { Solicitudes } from './solicitudes';
import {
  ConteoPorEstado,
  PaginaSolicitudes,
  ResumenPlataforma,
  ResumenSolicitudes,
  SolicitudAdmin,
} from './solicitudes-api';
import { SolicitudesPlataforma } from './solicitudes-plataforma';
import { SolicitudesTenant } from './solicitudes-tenant';

const PLOMERIA = 'c0000000-0000-0000-0000-000000000001';
const CLIENTE = '2b8f6c1e-4d3a-4e5b-9c7d-1a2b3c4d5e6f';
const TECNICO = '9d1e2f3a-4b5c-4d6e-8f7a-0b1c2d3e4f5a';
const ALFA = '5f0c2d8e-1a3b-4c5d-9e6f-7a8b9c0d1e2f';
const BETA = '6a1d3e9f-2b4c-4d6e-8f7a-8b9c0d1e2f3a';

function conteos(valores: Partial<ConteoPorEstado> = {}): ConteoPorEstado {
  return {
    ...(Object.fromEntries(ESTADOS_SOLICITUD.map((e) => [e, 0])) as ConteoPorEstado),
    ...valores,
  };
}

function resumen(valores: Partial<ConteoPorEstado> = {}, createdToday = 0): ResumenSolicitudes {
  return { generatedAt: '2026-10-18T16:00:00Z', byStatus: conteos(valores), createdToday };
}

function solicitud(id: string, valores: Partial<SolicitudAdmin> = {}): SolicitudAdmin {
  return {
    id,
    status: 'buscando_tecnico',
    categoryId: PLOMERIA,
    clientId: CLIENTE,
    technicianId: null,
    createdAt: '2026-10-14T15:02:11Z',
    assignedAt: null,
    ...valores,
  };
}

function pagina(items: SolicitudAdmin[], totalItems = items.length, page = 1): PaginaSolicitudes {
  return { items, page, size: 20, totalItems };
}

function texto(elemento: Element | null): string {
  return (elemento?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function boton(el: HTMLElement, contiene: string): HTMLButtonElement {
  return Array.from(el.querySelectorAll('button')).find((b) =>
    texto(b).includes(contiene),
  ) as HTMLButtonElement;
}

describe('Solicitudes', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function estable<T>(fixture: ComponentFixture<T>): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function crear<T>(componente: Type<T>) {
    const fixture = TestBed.createComponent(componente);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  describe('administrador del tenant', () => {
    function lista() {
      return http.expectOne((req) => req.url === '/api/v1/service-requests');
    }

    function tecnicos() {
      return http.expectOne((req) => req.url === '/api/v1/admin/technicians');
    }

    function paginaTecnicos(
      items: { userId: string; fullName: string }[],
      totalItems = items.length,
    ) {
      return { items, page: 1, size: 100, totalItems };
    }

    function resumenTenant() {
      return http.expectOne('/api/v1/admin/service-requests/summary');
    }

    async function cargado(
      r: ResumenSolicitudes = resumen(),
      p: PaginaSolicitudes = pagina([solicitud('s1')]),
    ) {
      const { fixture, el } = crear(SolicitudesTenant);
      http.expectOne('/api/v1/service-requests/categories').flush([{ id: PLOMERIA, name: 'Plomería' }]);
      tecnicos().flush(paginaTecnicos([{ userId: TECNICO, fullName: 'Andrés Rojas' }]));
      resumenTenant().flush(r);
      lista().flush(p);
      await estable(fixture);
      return { fixture, el };
    }

    it('pide la primera página sin filtro y nunca envía el tenant', () => {
      crear(SolicitudesTenant);
      http.expectOne('/api/v1/service-requests/categories').flush([]);
      tecnicos().flush(paginaTecnicos([]));
      resumenTenant().flush(resumen());
      const req = lista();
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('size')).toBe('20');
      expect(req.request.params.has('status')).toBe(false);
      expect(req.request.params.keys()).not.toContain('tenantId');
      req.flush(pagina([]));
    });

    it('muestra los conteos activos, los cerrados y los creados hoy', async () => {
      const { el } = await cargado(
        resumen({ buscando_tecnico: 4, en_espera: 1, asignado: 6, cancelado: 2 }, 5),
      );

      const activas = Array.from(el.querySelectorAll('button.conteo')).map((b) =>
        b.getAttribute('aria-label'),
      );
      expect(activas).toEqual([
        'Buscando técnico: 4',
        'En espera: 1',
        'Asignado: 6',
        'Cotizado: 0',
        'Cotización aceptada: 0',
        'En progreso: 0',
      ]);
      expect(texto(el.querySelector('button.conteo .cifra'))).toBe('4');
      const cerradas = Array.from(el.querySelectorAll('.cerradas button')).map(texto);
      expect(cerradas).toEqual(['Completado 0', 'Pagado 0', 'Cancelado 2']);
      expect(texto(el.querySelector('.hoy'))).toBe('Creadas hoy: 5');
      expect(el.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-18T16:00:00Z');
    });

    it('lista cada solicitud con la categoría, los identificadores cortos y las fechas', async () => {
      const { el } = await cargado(
        resumen(),
        pagina([
          solicitud('s1', {
            status: 'asignado',
            technicianId: TECNICO,
            assignedAt: '2026-10-14T15:04:40Z',
          }),
          solicitud('s2', { categoryId: 'otra' }),
        ]),
      );
      const [asignada, buscando] = Array.from(el.querySelectorAll('tbody tr'));

      expect(texto(asignada.querySelector('[data-etiqueta="Estado"]'))).toBe('Asignado');
      expect(texto(asignada.querySelector('[data-etiqueta="Categoría"]'))).toBe('Plomería');
      expect(texto(asignada.querySelector('[data-etiqueta="Cliente"]'))).toBe('3c4d5e6f');
      expect(asignada.querySelector('[data-etiqueta="Cliente"] code')?.getAttribute('title')).toBe(
        CLIENTE,
      );
      expect(texto(asignada.querySelector('[data-etiqueta="Técnico"]'))).toBe('Andrés Rojas');
      expect(asignada.querySelector('[data-etiqueta="Asignada"] time')).not.toBeNull();
      expect(texto(buscando.querySelector('[data-etiqueta="Técnico"]'))).toBe('Sin asignar');
      expect(texto(buscando.querySelector('[data-etiqueta="Asignada"]'))).toBe('—');
      // Una categoría que ya no está en el catálogo no muestra su identificador.
      expect(texto(buscando.querySelector('[data-etiqueta="Categoría"]'))).toBe('—');
    });

    it('un técnico que no está en la lista del tenant se muestra con su ID corto', async () => {
      const { el } = await cargado(
        resumen(),
        pagina([solicitud('s1', { status: 'asignado', technicianId: CLIENTE })]),
      );
      const celda = el.querySelector('[data-etiqueta="Técnico"]');
      expect(texto(celda)).toBe('3c4d5e6f');
      expect(celda?.querySelector('code')?.getAttribute('title')).toBe(CLIENTE);
    });

    describe('cancelación (RF-36, SCRUM-477)', () => {
      function cancelacion() {
        return http.expectOne(
          (req) => req.method === 'POST' && req.url === '/api/v1/service-requests/s1/cancel',
        );
      }

      async function abrirDialogo(fixture: ComponentFixture<SolicitudesTenant>, el: HTMLElement) {
        boton(el, 'Cancelar').click();
        fixture.detectChanges();
        expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(true);
      }

      function escribir(
        fixture: ComponentFixture<SolicitudesTenant>,
        el: HTMLElement,
        valor: string,
      ) {
        const campo = el.querySelector<HTMLTextAreaElement>('#motivo-cancelacion')!;
        campo.value = valor;
        campo.dispatchEvent(new Event('input'));
        fixture.detectChanges();
      }

      it('solo ofrece cancelar antes de que inicie el servicio', async () => {
        const estados = [
          'buscando_tecnico',
          'en_espera',
          'asignado',
          'cotizado',
          'cotizacion_aceptada',
          'en_progreso',
          'completado',
          'pagado',
          'cancelado',
        ] as const;
        const { el } = await cargado(
          resumen(),
          pagina(estados.map((status, i) => solicitud(`s${i}`, { status }))),
        );
        const conBoton = Array.from(el.querySelectorAll('tbody tr')).map(
          (fila) => fila.querySelector('td.acciones button') !== null,
        );
        expect(conBoton).toEqual([true, true, true, true, true, false, false, false, false]);
        expect(el.querySelector('td.acciones button')?.getAttribute('aria-label')).toBe(
          'Cancelar la solicitud de Plomería del cliente 3c4d5e6f',
        );
      });

      it('pide un motivo de 5 a 500 caracteres antes de llamar al backend', async () => {
        const { fixture, el } = await cargado();
        await abrirDialogo(fixture, el);
        escribir(fixture, el, ' no ');

        boton(el, 'Sí, cancelar').click();
        await estable(fixture);

        http.expectNone((req) => req.method === 'POST');
        expect(texto(el.querySelector('#motivo-cancelacion-error'))).toBe(
          'Escribe un motivo de 5 a 500 caracteres.',
        );
        expect(el.querySelector('#motivo-cancelacion')?.getAttribute('aria-invalid')).toBe('true');
      });

      it('cancela con el motivo sin espacios, cierra el diálogo y actualiza conteos y lista', async () => {
        const { fixture, el } = await cargado();
        await abrirDialogo(fixture, el);
        expect(texto(el.querySelector('dialog .cuerpo p'))).toContain('se deja de buscar técnico');
        escribir(fixture, el, '  Cliente sin respuesta.  ');

        boton(el, 'Sí, cancelar').click();
        const req = cancelacion();
        expect(req.request.body).toEqual({ reason: 'Cliente sin respuesta.' });
        expect(req.request.body).not.toHaveProperty('tenantId');
        req.flush({
          id: 's1',
          status: 'cancelado',
          cancelledAt: '2026-10-19T16:20:00Z',
          cancelledByType: 'admin_tenant',
        });
        await estable(fixture);
        resumenTenant().flush(resumen({ cancelado: 1 }));
        lista().flush(pagina([solicitud('s1', { status: 'cancelado' })]));
        await estable(fixture);

        expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(false);
        expect(texto(el.querySelector('p.oculto[role="status"]'))).toBe(
          'Solicitud del cliente 3c4d5e6f cancelada.',
        );
        expect(el.querySelector('td.acciones button')).toBeNull();
      });

      it('un 409 avisa que ya no se puede cancelar y actualiza la lista', async () => {
        const { fixture, el } = await cargado(
          resumen(),
          pagina([solicitud('s1', { status: 'asignado', technicianId: TECNICO })]),
        );
        await abrirDialogo(fixture, el);
        expect(texto(el.querySelector('dialog .cuerpo p'))).toContain(
          'el técnico asignado queda libre',
        );
        escribir(fixture, el, 'Cliente sin respuesta.');

        boton(el, 'Sí, cancelar').click();
        cancelacion().flush(
          {
            type: 'https://quickpatch.internal/problems/transicion-invalida',
            title: 'La solicitud ya no se puede cancelar',
            status: 409,
          },
          { status: 409, statusText: 'Conflict' },
        );
        await estable(fixture);
        resumenTenant().flush(resumen({ en_progreso: 1 }));
        lista().flush(pagina([solicitud('s1', { status: 'en_progreso', technicianId: TECNICO })]));
        await estable(fixture);

        expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(false);
        expect(texto(el.querySelector('p.alerta[role="alert"]'))).toBe(
          'La solicitud ya no se puede cancelar: el servicio inició o ya estaba cancelada.',
        );
        expect(el.querySelector('td.acciones button')).toBeNull();
      });

      it('un 400 de reason se muestra en el campo y el diálogo sigue abierto', async () => {
        const { fixture, el } = await cargado();
        await abrirDialogo(fixture, el);
        escribir(fixture, el, 'Cliente sin respuesta.');

        boton(el, 'Sí, cancelar').click();
        cancelacion().flush(
          {
            type: 'https://quickpatch.internal/problems/validacion',
            title: 'La solicitud tiene datos inválidos',
            status: 400,
            errors: { reason: ['El motivo debe tener entre 5 y 500 caracteres.'] },
          },
          { status: 400, statusText: 'Bad Request' },
        );
        await estable(fixture);

        expect(texto(el.querySelector('#motivo-cancelacion-error'))).toBe(
          'El motivo debe tener entre 5 y 500 caracteres.',
        );
        expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(true);
      });

      it('volver cierra el diálogo sin cancelar', async () => {
        const { fixture, el } = await cargado();
        await abrirDialogo(fixture, el);

        boton(el, 'Volver').click();
        fixture.detectChanges();

        http.expectNone((req) => req.method === 'POST');
        expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(false);
      });
    });

    it('pide los técnicos de a 100 hasta tenerlos todos', async () => {
      const { fixture, el } = crear(SolicitudesTenant);
      http.expectOne('/api/v1/service-requests/categories').flush([]);
      const primera = tecnicos();
      expect(primera.request.params.get('page')).toBe('1');
      expect(primera.request.params.get('size')).toBe('100');
      expect(primera.request.params.has('verificationStatus')).toBe(false);
      const cien = Array.from({ length: 100 }, (_, i) => ({ userId: `t${i}`, fullName: `T ${i}` }));
      primera.flush(paginaTecnicos(cien, 101));
      resumenTenant().flush(resumen());
      lista().flush(pagina([solicitud('s1', { technicianId: TECNICO })]));
      await fixture.whenStable();
      const segunda = tecnicos();
      expect(segunda.request.params.get('page')).toBe('2');
      segunda.flush(paginaTecnicos([{ userId: TECNICO, fullName: 'Andrés Rojas' }], 101));
      await estable(fixture);
      expect(texto(el.querySelector('[data-etiqueta="Técnico"]'))).toBe('Andrés Rojas');
    });

    it('sin la lista de técnicos muestra el ID corto y no avisa error', async () => {
      const { fixture, el } = crear(SolicitudesTenant);
      http.expectOne('/api/v1/service-requests/categories').flush([]);
      tecnicos().flush({}, { status: 503, statusText: 'Service Unavailable' });
      resumenTenant().flush(resumen());
      lista().flush(pagina([solicitud('s1', { technicianId: TECNICO })]));
      await estable(fixture);
      expect(texto(el.querySelector('[data-etiqueta="Técnico"]'))).toBe('2d3e4f5a');
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });

    it('copia el ID completo del cliente y lo anuncia', async () => {
      const escribir = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: escribir },
        configurable: true,
      });
      const { fixture, el } = await cargado();
      const copiar = el.querySelector('button.copiar') as HTMLButtonElement;
      expect(copiar.getAttribute('aria-label')).toBe('Copiar el ID completo del cliente 3c4d5e6f');

      copiar.click();
      await estable(fixture);
      expect(escribir).toHaveBeenCalledWith(CLIENTE);
      expect(texto(el.querySelector('[role="status"]'))).toBe('ID del cliente copiado.');

      escribir.mockRejectedValueOnce(new Error('denegado'));
      copiar.click();
      await estable(fixture);
      expect(texto(el.querySelector('[role="status"]'))).toBe('No se pudo copiar el ID.');
    });

    it('al tocar un conteo filtra la lista por ese estado y al tocarlo otra vez lo quita', async () => {
      const { fixture, el } = await cargado();

      boton(el, 'En espera').click();
      const filtrada = lista();
      expect(filtrada.request.params.get('status')).toBe('en_espera');
      expect(filtrada.request.params.get('page')).toBe('1');
      filtrada.flush(pagina([]));
      await estable(fixture);
      expect(boton(el, 'En espera').getAttribute('aria-pressed')).toBe('true');
      expect(texto(el.querySelector('.vacio strong'))).toBe('No hay solicitudes en «en espera».');

      boton(el, 'En espera').click();
      expect(lista().request.params.has('status')).toBe(false);
    });

    it('«Ver todas» quita el filtro de un estado cerrado', async () => {
      const { fixture, el } = await cargado();
      boton(el, 'Cancelado').click();
      expect(lista().request.params.get('status')).toBe('cancelado');
      await estable(fixture);

      boton(el, 'Ver todas').click();
      lista().flush(pagina([]));
      await estable(fixture);
      expect(el.querySelector('[aria-pressed="true"]')).toBeNull();
      expect(texto(el.querySelector('.vacio strong'))).toBe(
        'Tu empresa todavía no tiene solicitudes.',
      );
    });

    it('pagina con el servidor', async () => {
      const varias = Array.from({ length: 20 }, (_, i) => solicitud(`s${i}`));
      const { fixture, el } = await cargado(resumen(), pagina(varias, 45));
      expect(texto(el.querySelector('.paginacion .numerico'))).toBe('1–20 de 45');
      expect(boton(el, 'Anterior').disabled).toBe(true);

      boton(el, 'Siguiente').click();
      const segunda = lista();
      expect(segunda.request.params.get('page')).toBe('2');
      segunda.flush(pagina(varias, 45, 2));
      await estable(fixture);
      expect(texto(el.querySelector('.paginacion .numerico'))).toBe('21–40 de 45');
    });

    it('si la página queda vacía vuelve a la anterior', async () => {
      const varias = Array.from({ length: 20 }, (_, i) => solicitud(`s${i}`));
      const { fixture, el } = await cargado(resumen(), pagina(varias, 21));
      boton(el, 'Siguiente').click();
      lista().flush(pagina([], 20, 2));
      await fixture.whenStable();
      const anterior = lista();
      expect(anterior.request.params.get('page')).toBe('1');
      anterior.flush(pagina(varias, 20));
      await estable(fixture);
      expect(el.querySelector('.paginacion')).toBeNull();
    });

    it('se actualiza cada minuto sin volver a mostrar la carga', async () => {
      vi.useFakeTimers();
      const { fixture, el } = await cargado();

      vi.advanceTimersByTime(INTERVALO_ACTUALIZACION_MS - 1);
      http.expectNone('/api/v1/admin/service-requests/summary');

      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(el.querySelector('.fila-esqueleto')).toBeNull();
      resumenTenant().flush(resumen({ asignado: 7 }));
      lista().flush(pagina([solicitud('s1')]));
      await estable(fixture);
      expect(boton(el, 'Asignado').getAttribute('aria-label')).toBe('Asignado: 7');
    });

    it('con la pestaña oculta no consulta y al volver actualiza enseguida', async () => {
      vi.useFakeTimers();
      const { fixture } = await cargado();
      const visibilidad = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

      vi.advanceTimersByTime(INTERVALO_ACTUALIZACION_MS * 2);
      http.expectNone('/api/v1/admin/service-requests/summary');

      visibilidad.mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      resumenTenant().flush(resumen());
      lista().flush(pagina([]));
      await estable(fixture);
      visibilidad.mockRestore();
    });

    it('si una actualización falla conserva los datos y avisa', async () => {
      vi.useFakeTimers();
      const { fixture, el } = await cargado(resumen({ asignado: 6 }));

      vi.advanceTimersByTime(INTERVALO_ACTUALIZACION_MS);
      resumenTenant().flush({}, { status: 503, statusText: 'Service Unavailable' });
      lista().flush(pagina([solicitud('s1')]));
      await estable(fixture);

      expect(texto(el.querySelector('[role="alert"]'))).toContain(
        'No pudimos actualizar las solicitudes.',
      );
      expect(boton(el, 'Asignado').getAttribute('aria-label')).toBe('Asignado: 6');
      expect(el.querySelectorAll('tbody tr')).toHaveLength(1);
    });

    it('si la primera carga falla muestra el error', async () => {
      const { fixture, el } = crear(SolicitudesTenant);
      http.expectOne('/api/v1/service-requests/categories').flush([]);
      tecnicos().flush(paginaTecnicos([]));
      resumenTenant().flush({}, { status: 403, statusText: 'Forbidden' });
      lista().flush({}, { status: 403, statusText: 'Forbidden' });
      await estable(fixture);

      const alerta = texto(el.querySelector('[role="alert"]'));
      expect(alerta).not.toBe('');
      expect(alerta).not.toContain('No pudimos actualizar');
      expect(el.querySelector('button.conteo')?.getAttribute('aria-label')).toBe(
        'Buscando técnico: –',
      );
    });

    it('deja de actualizarse al salir de la página', async () => {
      vi.useFakeTimers();
      const { fixture } = await cargado();
      fixture.destroy();
      vi.advanceTimersByTime(INTERVALO_ACTUALIZACION_MS * 3);
      document.dispatchEvent(new Event('visibilitychange'));
      http.expectNone('/api/v1/admin/service-requests/summary');
    });
  });

  describe('administrador de plataforma', () => {
    function resumenPlataforma() {
      return http.expectOne((req) => req.url === '/api/v1/platform/service-requests/summary');
    }

    const TENANTS = [
      { id: ALFA, name: 'Hogar Express', nit: '900', status: 'activo', createdAt: '' },
      { id: BETA, name: 'Tenant Beta', nit: '901', status: 'activo', createdAt: '' },
    ];

    function plataforma(tenants: ResumenPlataforma['tenants']): ResumenPlataforma {
      return { generatedAt: '2026-10-18T16:00:00Z', tenants };
    }

    async function cargado(r = plataforma([])) {
      const { fixture, el } = crear(SolicitudesPlataforma);
      http.expectOne('/api/v1/platform/tenants').flush(TENANTS);
      resumenPlataforma().flush(r);
      await estable(fixture);
      return { fixture, el };
    }

    function celdas(fila: Element): string[] {
      return Array.from(fila.querySelectorAll('th, td')).map(texto);
    }

    it('muestra una fila por tenant, con 0 si no tiene solicitudes', async () => {
      const { el } = await cargado(
        plataforma([
          {
            tenantId: ALFA,
            byStatus: conteos({ buscando_tecnico: 4, en_espera: 1, asignado: 6, cancelado: 2 }),
            createdToday: 5,
          },
        ]),
      );
      const filas = Array.from(el.querySelectorAll('tbody tr'));

      expect(filas).toHaveLength(2);
      expect(celdas(filas[0])).toEqual([
        'Hogar Express',
        '11',
        '4',
        '1',
        '6',
        '0',
        '0',
        '0',
        '0',
        '0',
        '2',
        '5',
      ]);
      expect(celdas(filas[1])).toEqual(['Tenant Beta', ...Array(11).fill('0')]);
      expect(Array.from(el.querySelectorAll('thead th')).map(texto)).toEqual([
        'Tenant',
        'Activas',
        'Buscando técnico',
        'En espera',
        'Asignado',
        'Cotizado',
        'Cotización aceptada',
        'En progreso',
        'Completado',
        'Pagado',
        'Cancelado',
        'Creadas hoy',
      ]);
    });

    it('filtra por tenant con el parámetro de la operación de plataforma', async () => {
      const { fixture, el } = await cargado();
      const selector = el.querySelector('#filtro-tenant') as HTMLSelectElement;
      expect(Array.from(selector.options).map((o) => o.text)).toEqual([
        'Todos',
        'Hogar Express',
        'Tenant Beta',
      ]);

      selector.value = BETA;
      selector.dispatchEvent(new Event('change'));
      const req = resumenPlataforma();
      expect(req.request.params.get('tenantId')).toBe(BETA);
      req.flush(plataforma([]));
      await estable(fixture);
      expect(Array.from(el.querySelectorAll('tbody th')).map(texto)).toEqual(['Tenant Beta']);

      selector.value = '';
      selector.dispatchEvent(new Event('change'));
      expect(resumenPlataforma().request.params.has('tenantId')).toBe(false);
    });

    it('sin la lista de tenants muestra los conteos con el identificador', async () => {
      const { fixture, el } = crear(SolicitudesPlataforma);
      http.expectOne('/api/v1/platform/tenants').flush({}, { status: 503, statusText: 'x' });
      resumenPlataforma().flush(
        plataforma([{ tenantId: ALFA, byStatus: conteos(), createdToday: 0 }]),
      );
      await estable(fixture);
      expect(Array.from(el.querySelectorAll('tbody th')).map(texto)).toEqual([ALFA]);
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });

    it('se actualiza cada minuto y conserva los datos si falla', async () => {
      vi.useFakeTimers();
      const { fixture, el } = await cargado(
        plataforma([{ tenantId: ALFA, byStatus: conteos({ asignado: 3 }), createdToday: 1 }]),
      );

      vi.advanceTimersByTime(INTERVALO_ACTUALIZACION_MS);
      resumenPlataforma().flush({}, { status: 503, statusText: 'Service Unavailable' });
      await estable(fixture);

      expect(texto(el.querySelector('[role="alert"]'))).toContain(
        'No pudimos actualizar los conteos.',
      );
      expect(texto(el.querySelector('tbody td.activas'))).toBe('3');
    });
  });

  describe('página', () => {
    async function conRol(rol: 'admin_tenant' | 'admin_plataforma') {
      const sesion = TestBed.inject(Sesion);
      const promesa = sesion.iniciar('admin@quickpatch.co', 'x');
      http.expectOne('/api/v1/auth/login').flush({
        accessToken: 't',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: { id: 'u', email: 'admin@quickpatch.co', fullName: 'Laura Gómez', role: rol },
      });
      await promesa;
      return crear(Solicitudes).el;
    }

    it('al administrador del tenant le muestra las solicitudes de su empresa', async () => {
      const el = await conRol('admin_tenant');
      expect(el.querySelector('app-solicitudes-tenant')).not.toBeNull();
      expect(el.querySelector('app-solicitudes-plataforma')).toBeNull();
      http.expectOne('/api/v1/service-requests/categories').flush([]);
      http
        .expectOne((req) => req.url === '/api/v1/admin/technicians')
        .flush({ items: [], page: 1, size: 100, totalItems: 0 });
      http.expectOne('/api/v1/admin/service-requests/summary').flush(resumen());
      http.expectOne((req) => req.url === '/api/v1/service-requests').flush(pagina([]));
    });

    it('al administrador de plataforma solo le muestra los conteos por tenant', async () => {
      const el = await conRol('admin_plataforma');
      expect(el.querySelector('app-solicitudes-plataforma')).not.toBeNull();
      expect(el.querySelector('app-solicitudes-tenant')).toBeNull();
      expect(texto(el.querySelector('.encabezado-pagina p'))).toContain(
        'no incluye datos de los clientes',
      );
      http.expectOne('/api/v1/platform/tenants').flush([]);
      http
        .expectOne((req) => req.url === '/api/v1/platform/service-requests/summary')
        .flush({ generatedAt: '2026-10-18T16:00:00Z', tenants: [] });
      http.expectNone((req) => req.url === '/api/v1/service-requests');
    });
  });
});
