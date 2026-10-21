import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DESCARGA_APP, Presentacion } from './presentacion';

describe('Presentacion (SCRUM-491)', () => {
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Presentacion);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  function enlaces(texto: string): HTMLAnchorElement[] {
    return Array.from(el.querySelectorAll('a')).filter((a) => a.textContent?.includes(texto));
  }

  it('un solo h1 con la propuesta de valor y las secciones con su título', () => {
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('h1')?.textContent).toContain('precio claro');
    const titulos = Array.from(el.querySelectorAll('h2')).map((h) => h.textContent?.trim());
    expect(titulos).toEqual([
      'De la solicitud a la calificación, en seis pasos',
      'Una app para todos los que hacen parte del servicio',
      'Seguridad en cada paso',
      'Lleva QUICKPATCH en tu celular',
    ]);
  });

  it('el ciclo del servicio en seis pasos, numerados y en orden', () => {
    const pasos = Array.from(el.querySelectorAll('.pasos > li h3')).map((h) => h.textContent);
    expect(pasos).toEqual([
      'Pide el servicio',
      'Te asignamos un técnico',
      'Conoce el precio antes',
      'Sigue el trabajo en vivo',
      'Paga seguro',
      'Califica',
    ]);
    expect(el.querySelector('.pasos > li:last-child .numero')?.textContent).toBe('6');
  });

  it('los cuatro usuarios de la app y las cuatro garantías', () => {
    const tarjetas = (id: string) =>
      Array.from(el.querySelectorAll(`#${id} .tarjeta-info h3`)).map((h) => h.textContent);
    expect(tarjetas('para-quien')).toEqual(['Clientes', 'Empresas', 'Técnicos', 'Proveedores']);
    expect(tarjetas('confianza')).toEqual([
      'Técnicos verificados',
      'Tu tarjeta no se guarda',
      'Datos protegidos',
      'Evidencia de cada servicio',
    ]);
  });

  it('la descarga abre el último APK en otra pestaña y lo anuncia', () => {
    const descargas = enlaces('Descargar la app');
    expect(descargas.length).toBe(2);
    for (const a of descargas) {
      expect(a.getAttribute('href')).toBe(DESCARGA_APP);
      expect(a.target).toBe('_blank');
      expect(a.rel).toBe('noopener');
      expect(a.textContent).toContain('se abre en una pestaña nueva');
    }
  });

  it('lleva al inicio de sesión del panel y a las secciones de la página', () => {
    expect(enlaces('Iniciar sesión')[0].getAttribute('href')).toBe('/iniciar-sesion');
    expect(enlaces('Ir al panel')[0].getAttribute('href')).toBe('/iniciar-sesion');
    const anclas = Array.from(el.querySelectorAll('nav a')).map((a) => a.getAttribute('href'));
    expect(anclas).toEqual(['#como-funciona', '#para-quien', '#confianza']);
    for (const ancla of anclas) {
      expect(el.querySelector(ancla as string)).not.toBeNull();
    }
  });

  it('la maqueta marca los estados hechos, el actual y los pendientes', () => {
    const clases = Array.from(el.querySelectorAll('.linea-tiempo li')).map((li) => li.className);
    expect(clases).toEqual(['hecho', 'hecho', 'hecho', 'actual', 'pendiente']);
  });
});
