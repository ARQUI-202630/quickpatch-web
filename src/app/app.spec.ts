import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('crea la aplicación', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra el título del panel', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.querySelector('h1')?.textContent).toContain('Panel administrativo');
  });
});
