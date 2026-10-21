import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Tecnicos } from './tecnicos';
import { PaginaTecnicos, TecnicoAdmin } from './tecnicos-api';

const PLOMERIA = 'c0000000-0000-0000-0000-000000000001';
const PROBLEMA = 'https://quickpatch.internal/problems/';

function tecnico(
  id: string,
  nombre: string,
  estado: TecnicoAdmin['verificationStatus'],
): TecnicoAdmin {
  return {
    userId: id,
    fullName: nombre,
    email: `${id}@correo.co`,
    phone: null,
    role: 'tecnico',
    documentId: `CC ${id}`,
    specialtyId: PLOMERIA,
    verificationStatus: estado,
    verificationReason: null,
    createdAt: '2026-10-05T00:00:00Z',
  };
}

function pagina(items: TecnicoAdmin[], totalItems = items.length, page = 1): PaginaTecnicos {
  return { items, page, size: 20, totalItems };
}

function varios(n: number): TecnicoAdmin[] {
  return Array.from({ length: n }, (_, i) => tecnico(`t${i}`, `Técnico ${i}`, 'pendiente'));
}

function texto(elemento: Element | null): string {
  return elemento?.textContent ?? '';
}

function botones(elemento: HTMLElement, etiqueta: string): HTMLButtonElement[] {
  return Array.from(elemento.querySelectorAll('button')).filter(
    (b) => texto(b).trim() === etiqueta,
  );
}

describe('Tecnicos', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function listado() {
    return http.expectOne((req) => req.url === '/api/v1/admin/technicians');
  }

  async function estable(fixture: ComponentFixture<Tecnicos>): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function crear(lista: PaginaTecnicos, conCatalogo = true) {
    const fixture = TestBed.createComponent(Tecnicos);
    fixture.detectChanges();
    const catalogo = http.expectOne('/api/v1/service-requests/categories');
    if (conCatalogo) {
      catalogo.flush([{ id: PLOMERIA, name: 'Plomería' }]);
    } else {
      catalogo.flush({}, { status: 503, statusText: 'Service Unavailable' });
    }
    listado().flush(lista);
    await estable(fixture);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function escribirMotivo(el: HTMLElement, valor: string): void {
    const campo = el.querySelector('#motivo') as HTMLTextAreaElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  it('muestra los pendientes del tenant por defecto, con la especialidad y sus acciones', async () => {
    const fixture = TestBed.createComponent(Tecnicos);
    fixture.detectChanges();
    http.expectOne('/api/v1/service-requests/categories').flush([{ id: PLOMERIA, name: 'Plomería' }]);
    const req = listado();
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('verificationStatus')).toBe('pendiente');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.keys()).not.toContain('tenantId');
    req.flush(pagina([tecnico('a1', 'Ana Ruiz', 'pendiente')]));
    await estable(fixture);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(texto(el)).toContain('Ana Ruiz');
    expect(texto(el)).toContain('a1@correo.co');
    expect(texto(el)).toContain('CC a1');
    expect(texto(el)).toContain('Plomería');
    expect(texto(el)).toContain('Pendiente');
    expect(botones(el, 'Aprobar').length).toBe(1);
    expect(botones(el, 'Rechazar')[0].classList).toContain('peligro');
    expect(botones(el, 'Rechazar')[0].getAttribute('aria-label')).toBe('Rechazar a Ana Ruiz');
    expect(botones(el, 'Pendientes')[0].getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('.paginacion')).toBeNull();
  });

  it('ofrece solo las acciones que admite cada estado (DD 8.3.13)', async () => {
    const { el } = await crear(
      pagina([
        tecnico('a1', 'Ana', 'pendiente'),
        tecnico('b2', 'Beto', 'aprobado'),
        tecnico('c3', 'Caro', 'rechazado'),
        tecnico('d4', 'Dani', 'suspendido'),
      ]),
    );
    const acciones = Array.from(el.querySelectorAll('td.acciones')).map((td) =>
      Array.from(td.querySelectorAll('button')).map((b) => texto(b).trim()),
    );

    expect(acciones).toEqual([['Aprobar', 'Rechazar'], ['Suspender'], ['Aprobar'], ['Reactivar']]);
  });

  it('distingue técnico de proveedor', async () => {
    const proveedor: TecnicoAdmin = {
      ...tecnico('p1', 'Taller Sur', 'pendiente'),
      role: 'proveedor',
    };
    const { el } = await crear(pagina([tecnico('a1', 'Ana', 'pendiente'), proveedor]));
    const tipos = Array.from(el.querySelectorAll('td[data-etiqueta="Tipo"]')).map((td) =>
      texto(td).trim(),
    );

    expect(tipos).toEqual(['Técnico', 'Proveedor']);
  });

  it('aprueba sin cuerpo después de confirmar, avisa y recarga', async () => {
    const { fixture, el } = await crear(pagina([tecnico('a1', 'Ana Ruiz', 'pendiente')]));

    botones(el, 'Aprobar')[0].click();
    fixture.detectChanges();
    expect(texto(el)).toContain('¿Aprobar a Ana Ruiz?');
    expect(texto(el.querySelector('dialog'))).toContain('Podrá recibir solicitudes');
    expect(el.querySelector('#motivo')).toBeNull();
    expect(botones(el, 'Sí, aprobar')[0].classList).not.toContain('peligro');

    botones(el, 'Sí, aprobar')[0].click();
    const req = http.expectOne('/api/v1/admin/technicians/a1/approve');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush({ userId: 'a1', verificationStatus: 'aprobado', reason: null });
    await fixture.whenStable();
    listado().flush(pagina([]));
    await estable(fixture);

    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(false);
    expect(texto(el.querySelector('.aviso[role="status"]'))).toContain('Ana Ruiz quedó aprobado.');
    expect(texto(el)).toContain('No hay técnicos pendientes.');
  });

  it('rechazar exige un motivo de 5 a 500 caracteres y lo envía sin espacios sobrantes', async () => {
    const { fixture, el } = await crear(pagina([tecnico('a1', 'Ana Ruiz', 'pendiente')]));

    botones(el, 'Rechazar')[0].click();
    fixture.detectChanges();
    expect(botones(el, 'Sí, rechazar')[0].classList).toContain('peligro');
    expect(texto(el.querySelector('dialog'))).toContain('El técnico verá el motivo.');
    expect(el.querySelector('#motivo')?.getAttribute('maxlength')).toBe('500');

    botones(el, 'Sí, rechazar')[0].click();
    fixture.detectChanges();
    expect(texto(el.querySelector('#motivo-error'))).toContain(
      'Escribe un motivo de 5 a 500 caracteres.',
    );
    expect(el.querySelector('#motivo')?.getAttribute('aria-invalid')).toBe('true');

    escribirMotivo(el, '  abc  ');
    fixture.detectChanges();
    expect(el.querySelector('#motivo-error')).toBeNull();
    botones(el, 'Sí, rechazar')[0].click();
    fixture.detectChanges();
    expect(el.querySelector('#motivo-error')).not.toBeNull();

    escribirMotivo(el, '  Documento ilegible  ');
    fixture.detectChanges();
    expect(texto(el.querySelector('#motivo-cuenta')).trim()).toBe('18/500');
    botones(el, 'Sí, rechazar')[0].click();
    const req = http.expectOne('/api/v1/admin/technicians/a1/reject');
    expect(req.request.body).toEqual({ reason: 'Documento ilegible' });
    req.flush({ userId: 'a1', verificationStatus: 'rechazado', reason: 'Documento ilegible' });
    await fixture.whenStable();
    listado().flush(pagina([]));
    await estable(fixture);

    expect(texto(el.querySelector('.aviso'))).toContain('Ana Ruiz quedó rechazado.');
  });

  it('al abrir otra acción el motivo anterior se limpia', async () => {
    const { fixture, el } = await crear(pagina([tecnico('a1', 'Ana', 'pendiente')]));

    botones(el, 'Rechazar')[0].click();
    fixture.detectChanges();
    escribirMotivo(el, 'Motivo viejo');
    botones(el, 'Cancelar')[0].click();
    fixture.detectChanges();
    botones(el, 'Rechazar')[0].click();
    fixture.detectChanges();

    expect((el.querySelector('#motivo') as HTMLTextAreaElement).value).toBe('');
  });

  it('filtra por aprobados y suspende con motivo obligatorio (SCRUM-110)', async () => {
    const { fixture, el } = await crear(pagina([]));

    botones(el, 'Aprobados')[0].click();
    const req = listado();
    expect(req.request.params.get('verificationStatus')).toBe('aprobado');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pagina([tecnico('b2', 'Beto Gil', 'aprobado')]));
    await estable(fixture);
    expect(botones(el, 'Aprobados')[0].getAttribute('aria-pressed')).toBe('true');
    expect(botones(el, 'Pendientes')[0].getAttribute('aria-pressed')).toBe('false');
    expect(botones(el, 'Suspender')[0].classList).toContain('peligro');

    botones(el, 'Suspender')[0].click();
    fixture.detectChanges();
    expect(texto(el)).toContain('¿Suspender a Beto Gil?');
    expect(texto(el.querySelector('dialog'))).toContain('un servicio en curso no se interrumpe');
    expect(botones(el, 'Sí, suspender')[0].classList).toContain('peligro');

    botones(el, 'Sí, suspender')[0].click();
    fixture.detectChanges();
    expect(texto(el.querySelector('#motivo-error'))).toContain(
      'Escribe un motivo de 5 a 500 caracteres.',
    );

    escribirMotivo(el, '  Reclamos repetidos  ');
    botones(el, 'Sí, suspender')[0].click();
    const suspender = http.expectOne('/api/v1/admin/technicians/b2/suspend');
    expect(suspender.request.method).toBe('POST');
    expect(suspender.request.body).toEqual({ reason: 'Reclamos repetidos' });
    suspender.flush({
      userId: 'b2',
      verificationStatus: 'suspendido',
      reason: 'Reclamos repetidos',
    });
    await fixture.whenStable();
    const recarga = listado();
    expect(recarga.request.params.get('verificationStatus')).toBe('aprobado');
    recarga.flush(pagina([]));
    await estable(fixture);

    expect(texto(el.querySelector('.aviso'))).toContain('Beto Gil quedó suspendido.');
  });

  it('suspender un técnico que ya no está aprobado muestra el 409', async () => {
    const { fixture, el } = await crear(pagina([tecnico('b2', 'Beto Gil', 'aprobado')]));

    botones(el, 'Suspender')[0].click();
    fixture.detectChanges();
    escribirMotivo(el, 'Reclamos repetidos');
    botones(el, 'Sí, suspender')[0].click();
    http
      .expectOne('/api/v1/admin/technicians/b2/suspend')
      .flush(
        { type: `${PROBLEMA}transicion-invalida`, title: 'Conflict', status: 409 },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    listado().flush(pagina([tecnico('b2', 'Beto Gil', 'suspendido')]));
    await estable(fixture);

    expect(texto(el.querySelector('dialog [role="alert"]'))).toContain('ya no admite esta acción');
    botones(el, 'Cancelar')[0].click();
    fixture.detectChanges();
    expect(botones(el, 'Reactivar').length).toBe(1);
  });

  it('reactiva un suspendido con approve y muestra el motivo de la suspensión (SCRUM-110)', async () => {
    const suspendido = { ...tecnico('d4', 'Dani', 'suspendido'), verificationReason: 'Reclamos' };
    const { fixture, el } = await crear(pagina([suspendido]));
    expect(texto(el.querySelector('.motivo')).trim()).toBe('Reclamos');

    botones(el, 'Reactivar')[0].click();
    fixture.detectChanges();
    expect(texto(el)).toContain('¿Reactivar a Dani?');
    expect(texto(el.querySelector('dialog'))).toContain('Volverá a recibir solicitudes');
    expect(el.querySelector('#motivo')).toBeNull();
    botones(el, 'Sí, reactivar')[0].click();
    const req = http.expectOne('/api/v1/admin/technicians/d4/approve');
    expect(req.request.body).toBeNull();
    req.flush({ userId: 'd4', verificationStatus: 'aprobado', reason: null });
    await fixture.whenStable();
    listado().flush(pagina([]));
    await estable(fixture);

    expect(texto(el.querySelector('.aviso'))).toContain('Dani quedó reactivado.');
  });

  it('«Todos» no envía el filtro de estado y repetir el filtro actual no recarga', async () => {
    const { fixture, el } = await crear(pagina([]));

    botones(el, 'Pendientes')[0].click();
    botones(el, 'Todos')[0].click();
    const req = listado();
    expect(req.request.params.has('verificationStatus')).toBe(false);
    req.flush(pagina([]));
    await estable(fixture);

    expect(texto(el)).toContain('No hay técnicos ni proveedores registrados.');
  });

  it('un 409 se muestra en el diálogo y recarga la lista con las acciones vigentes', async () => {
    const { fixture, el } = await crear(pagina([tecnico('a1', 'Ana Ruiz', 'pendiente')]));

    botones(el, 'Aprobar')[0].click();
    fixture.detectChanges();
    botones(el, 'Sí, aprobar')[0].click();
    http
      .expectOne('/api/v1/admin/technicians/a1/approve')
      .flush(
        { type: `${PROBLEMA}transicion-invalida`, title: 'Conflict', status: 409 },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    listado().flush(pagina([tecnico('a1', 'Ana Ruiz', 'aprobado')]));
    await estable(fixture);

    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    expect(texto(el.querySelector('dialog [role="alert"]'))).toContain('ya no admite esta acción');

    botones(el, 'Cancelar')[0].click();
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(botones(el, 'Suspender').length).toBe(1);
  });

  it('un error de validación del servidor se muestra en el diálogo sin recargar', async () => {
    const { fixture, el } = await crear(pagina([tecnico('a1', 'Ana', 'pendiente')]));

    botones(el, 'Rechazar')[0].click();
    fixture.detectChanges();
    escribirMotivo(el, 'Motivo válido');
    botones(el, 'Sí, rechazar')[0].click();
    http
      .expectOne('/api/v1/admin/technicians/a1/reject')
      .flush({ type: `${PROBLEMA}validacion` }, { status: 400, statusText: 'Bad Request' });
    await estable(fixture);

    expect(texto(el.querySelector('dialog [role="alert"]'))).toContain(
      'Revisa los datos enviados.',
    );
  });

  it('pagina en el servidor', async () => {
    const veinte = varios(20);
    const { fixture, el } = await crear(pagina(veinte, 25));

    expect(texto(el.querySelector('.paginacion'))).toContain('1–20 de 25');
    expect(botones(el, 'Anterior')[0].disabled).toBe(true);

    botones(el, 'Siguiente')[0].click();
    const req = listado();
    expect(req.request.params.get('page')).toBe('2');
    req.flush(pagina(veinte.slice(0, 5), 25, 2));
    await estable(fixture);

    expect(texto(el.querySelector('.paginacion'))).toContain('21–25 de 25');
    expect(botones(el, 'Siguiente')[0].disabled).toBe(true);

    botones(el, 'Anterior')[0].click();
    const volver = listado();
    expect(volver.request.params.get('page')).toBe('1');
    volver.flush(pagina(veinte, 25));
    await estable(fixture);
  });

  it('cambiar de filtro vuelve a la primera página', async () => {
    const { fixture, el } = await crear(pagina(varios(20), 25));
    botones(el, 'Siguiente')[0].click();
    listado().flush(pagina(varios(5), 25, 2));
    await estable(fixture);

    botones(el, 'Rechazados')[0].click();
    const req = listado();
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('verificationStatus')).toBe('rechazado');
    req.flush(pagina([]));
    await estable(fixture);
  });

  it('si la acción vacía la última página vuelve a la anterior', async () => {
    const veinte = varios(20);
    const { fixture, el } = await crear(pagina(veinte, 21));
    botones(el, 'Siguiente')[0].click();
    listado().flush(pagina([tecnico('u', 'Último', 'pendiente')], 21, 2));
    await estable(fixture);

    botones(el, 'Aprobar')[0].click();
    fixture.detectChanges();
    botones(el, 'Sí, aprobar')[0].click();
    http
      .expectOne('/api/v1/admin/technicians/u/approve')
      .flush({ userId: 'u', verificationStatus: 'aprobado', reason: null });
    await fixture.whenStable();
    const vacia = listado();
    expect(vacia.request.params.get('page')).toBe('2');
    vacia.flush(pagina([], 20, 2));
    await fixture.whenStable();
    const anterior = listado();
    expect(anterior.request.params.get('page')).toBe('1');
    anterior.flush(pagina(veinte, 20));
    await estable(fixture);

    expect(el.querySelector('.paginacion')).toBeNull();
    expect(el.querySelectorAll('tbody tr').length).toBe(20);
  });

  it('sin catálogo la especialidad se muestra como «—» y la lista funciona', async () => {
    const { el } = await crear(pagina([tecnico('a1', 'Ana', 'pendiente')]), false);

    expect(texto(el.querySelector('td[data-etiqueta="Especialidad"]')).trim()).toBe('—');
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('muestra filas de carga y luego informa si la lista falla', async () => {
    const fixture = TestBed.createComponent(Tecnicos);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('tr.fila-esqueleto').length).toBe(3);
    expect(el.querySelector('table')?.getAttribute('aria-busy')).toBe('true');
    expect(texto(el)).toContain('Cargando técnicos');

    http.expectOne('/api/v1/service-requests/categories').flush([]);
    listado().flush({ type: `${PROBLEMA}no-autorizado` }, { status: 403, statusText: 'Forbidden' });
    await estable(fixture);

    expect(el.querySelectorAll('tr.fila-esqueleto').length).toBe(0);
    expect(texto(el.querySelector('[role="alert"]'))).toContain('No tienes permiso');
  });
});
