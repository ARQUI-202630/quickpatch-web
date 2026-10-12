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

  it('muestra el título del panel sin menú cuando no hay sesión', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('h1')?.textContent).toContain('Panel administrativo');
    expect(elemento.querySelector('nav')).toBeNull();
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

  it('con sesión de empresa solo muestra Inicio', async () => {
    await iniciarSesion('admin_tenant', 'Pedro');
    const { el } = renderizar();

    const enlaces = [...el.querySelectorAll('nav a')].map((a) => a.textContent?.trim());
    expect(enlaces).toEqual(['Inicio']);
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
