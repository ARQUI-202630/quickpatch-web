import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { App } from './app';
import { Sesion } from './core/sesion';

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
  });

  it('con sesión muestra el menú y permite salir', async () => {
    const sesion = TestBed.inject(Sesion);
    const promesa = sesion.iniciar('plataforma@quickpatch.co', 'x');
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/login')
      .flush({
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
    await promesa;
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.querySelector('nav a')?.textContent).toContain('Tenants');

    (elemento.querySelector('nav button') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(sesion.autenticado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/iniciar-sesion']);
  });
});
