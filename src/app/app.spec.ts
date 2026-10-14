import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { App } from './app';
import { Sesion } from './core/sesion';

async function iniciarSesion(role: string, fullName: string): Promise<Sesion> {
  const sesion = TestBed.inject(Sesion);
  const promesa = sesion.iniciar('admin@quickpatch.co', 'x');
  TestBed.inject(HttpTestingController)
    .expectOne('/api/v1/auth/login')
    .flush({
      accessToken: 't',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: { id: 'u', email: 'admin@quickpatch.co', fullName, role },
    });
  await promesa;
  return sesion;
}

function renderizar(): {
  fixture: ReturnType<typeof TestBed.createComponent<App>>;
  el: HTMLElement;
} {
  const fixture = TestBed.createComponent(App);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('App', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('sin sesión muestra solo el contenido público, sin barra lateral', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('.shell')).toBeNull();
    expect(elemento.querySelector('nav')).toBeNull();
    expect(elemento.querySelector('main.publico')).not.toBeNull();
    expect(elemento.querySelector('a.saltar')?.getAttribute('href')).toBe('#contenido');
  });

  it('con sesión de plataforma muestra Tenants, el usuario y permite salir', async () => {
    const sesion = await iniciarSesion('admin_plataforma', 'Laura Gómez Ruiz');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { fixture, el } = renderizar();

    const enlaces = [...el.querySelectorAll('nav a')].map((a) => a.textContent?.trim());
    expect(enlaces).toEqual(['Tenants']);
    expect(el.querySelector('.nombre')?.textContent).toContain('Laura Gómez Ruiz');
    expect(el.querySelector('.rol')?.textContent).toContain('Administrador de plataforma');
    expect(el.querySelector('.avatar')?.textContent?.trim()).toBe('LG');

    (el.querySelector('button.salir') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(sesion.autenticado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/iniciar-sesion']);
  });

  it('con sesión de empresa muestra Inicio y Técnicos', async () => {
    await iniciarSesion('admin_tenant', 'Pedro');
    const { el } = renderizar();

    const enlaces = [...el.querySelectorAll('nav a')].map((a) => a.textContent?.trim());
    expect(enlaces).toEqual(['Inicio', 'Técnicos']);
    expect(el.querySelector('.rol')?.textContent).toContain('Administrador de empresa');
    expect(el.querySelector('.avatar')?.textContent?.trim()).toBe('P');
  });

  it('abre y cierra el menú deslizable con el botón, el velo y Escape', async () => {
    await iniciarSesion('admin_plataforma', 'Laura');
    const { fixture, el } = renderizar();
    const abrir = el.querySelector('button.abrir-menu') as HTMLButtonElement;
    const shell = el.querySelector('.shell') as HTMLElement;

    expect(abrir.getAttribute('aria-expanded')).toBe('false');
    abrir.click();
    fixture.detectChanges();
    expect(abrir.getAttribute('aria-expanded')).toBe('true');
    expect(shell.classList).toContain('menu-abierto');

    (el.querySelector('.velo') as HTMLElement).click();
    fixture.detectChanges();
    expect(shell.classList).not.toContain('menu-abierto');

    abrir.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(abrir.getAttribute('aria-expanded')).toBe('false');

    abrir.click();
    (el.querySelector('button.cerrar-menu') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(shell.classList).not.toContain('menu-abierto');
  });

  it('el menú deslizable lleva el foco y deja inerte el resto mientras está abierto', async () => {
    await iniciarSesion('admin_plataforma', 'Laura');
    const { fixture, el } = renderizar();
    const abrir = el.querySelector('button.abrir-menu') as HTMLButtonElement;
    const cerrar = el.querySelector('button.cerrar-menu') as HTMLButtonElement;
    const area = el.querySelector('.area') as HTMLElement;

    expect(area.inert).toBe(false);
    abrir.click();
    await fixture.whenStable();
    expect(area.inert).toBe(true);
    expect(document.activeElement).toBe(cerrar);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(area.inert).toBe(false);
    expect(document.activeElement).toBe(abrir);

    // Escape con el menú cerrado no mueve el foco.
    cerrar.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(document.activeElement).toBe(cerrar);
  });

  it('el botón de menú también cierra el panel si ya está abierto', async () => {
    await iniciarSesion('admin_plataforma', 'Laura');
    const { fixture, el } = renderizar();
    const shell = el.querySelector('.shell') as HTMLElement;
    const app = fixture.componentInstance as unknown as { alternarMenu(): void };

    app.alternarMenu();
    fixture.detectChanges();
    expect(shell.classList).toContain('menu-abierto');
    app.alternarMenu();
    fixture.detectChanges();
    expect(shell.classList).not.toContain('menu-abierto');
  });

  it('cierra el panel si la ventana se ensancha', async () => {
    let alCambiar: ((e: Partial<MediaQueryListEvent>) => void) | undefined;
    const quitar = vi.fn();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        addEventListener: (_: string, fn: typeof alCambiar) => (alCambiar = fn),
        removeEventListener: quitar,
      })),
    );
    try {
      await iniciarSesion('admin_plataforma', 'Laura');
      const { fixture, el } = renderizar();
      (el.querySelector('button.abrir-menu') as HTMLButtonElement).click();
      fixture.detectChanges();

      alCambiar?.({ matches: false });
      fixture.detectChanges();
      expect(el.querySelector('.shell')?.classList).toContain('menu-abierto');
      alCambiar?.({ matches: true });
      fixture.detectChanges();
      expect(el.querySelector('.shell')?.classList).not.toContain('menu-abierto');

      fixture.destroy();
      expect(quitar).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('al navegar lleva el foco al contenido, salvo en la carga inicial', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'otra', children: [] },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    const { fixture, el } = renderizar();
    const contenido = el.querySelector('#contenido') as HTMLElement;

    await router.navigateByUrl('/');
    await fixture.whenStable();
    expect(document.activeElement).not.toBe(contenido);

    await router.navigateByUrl('/otra');
    await fixture.whenStable();
    expect(document.activeElement).toBe(contenido);
  });

  it('un rol sin acceso al panel no muestra enlaces ni nombre de rol', async () => {
    sessionStorage.setItem(
      'quickpatch.sesion',
      JSON.stringify({
        token: 't',
        venceEn: Date.now() + 60_000,
        usuario: { id: 'u', email: 'c@q.co', fullName: '', role: 'cliente' },
      }),
    );
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const { el } = renderizar();

    expect(el.querySelectorAll('nav a')).toHaveLength(0);
    expect(el.querySelector('.rol')?.textContent?.trim()).toBe('');
    expect(el.querySelector('.avatar')?.textContent?.trim()).toBe('');
  });
});
