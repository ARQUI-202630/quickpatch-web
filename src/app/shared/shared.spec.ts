import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CampoBusqueda, coincide, normalizar } from './campo-busqueda';
import { DialogoConfirmacion } from './dialogo-confirmacion';
import { EstadoVerificacion, EstadoVerificacionInsignia } from './estado-verificacion';
import { Insignia } from './insignia';
import { DatoDetalle, TarjetaDetalle } from './tarjeta-detalle';

describe('shared', () => {
  describe('búsqueda', () => {
    it('normaliza tildes, mayúsculas y espacios', () => {
      expect(normalizar('  Técnico ÁLVAREZ ')).toBe('tecnico alvarez');
    });

    it('coincide en cualquier campo y acepta la consulta vacía', () => {
      expect(coincide('', 'x')).toBe(true);
      expect(coincide('bogota', 'Fixit Bogotá', '900')).toBe(true);
      expect(coincide('900', 'Fixit', '900123')).toBe(true);
      expect(coincide('zzz', 'Fixit', null, undefined)).toBe(false);
    });

    it('el campo actualiza el valor enlazado y tiene nombre accesible', () => {
      @Component({
        imports: [CampoBusqueda],
        template: `<app-campo-busqueda etiqueta="Buscar técnicos" [(valor)]="consulta" />`,
      })
      class Anfitrion {
        readonly consulta = signal('inicial');
      }
      const fixture = TestBed.createComponent(Anfitrion);
      fixture.detectChanges();
      const input = (fixture.nativeElement as HTMLElement).querySelector(
        'input',
      ) as HTMLInputElement;

      expect(input.value).toBe('inicial');
      expect(input.closest('label')?.textContent).toContain('Buscar técnicos');
      input.value = 'ana';
      input.dispatchEvent(new Event('input'));
      expect(fixture.componentInstance.consulta()).toBe('ana');
    });
  });

  describe('insignias', () => {
    it('la insignia aplica el tono como clase', () => {
      @Component({
        imports: [Insignia],
        template: `<app-insignia tono="aviso">Pendiente</app-insignia
          ><app-insignia>Otro</app-insignia>`,
      })
      class Anfitrion {}
      const fixture = TestBed.createComponent(Anfitrion);
      fixture.detectChanges();
      const [aviso, neutro] = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('app-insignia'),
      );

      expect(aviso.classList).toContain('aviso');
      expect(aviso.textContent).toBe('Pendiente');
      expect(neutro.classList).toContain('neutro');
    });

    it.each<[EstadoVerificacion, string, string]>([
      ['pendiente', 'Pendiente', 'aviso'],
      ['aprobado', 'Aprobado', 'exito'],
      ['rechazado', 'Rechazado', 'peligro'],
      ['suspendido', 'Suspendido', 'neutro'],
    ])('el estado de verificación %s se muestra como %s', (estado, etiqueta, tono) => {
      const fixture = TestBed.createComponent(EstadoVerificacionInsignia);
      fixture.componentRef.setInput('estado', estado);
      fixture.detectChanges();
      const insignia = (fixture.nativeElement as HTMLElement).querySelector('app-insignia');

      expect(insignia?.textContent?.trim()).toBe(etiqueta);
      expect(insignia?.classList).toContain(tono);
    });
  });

  describe('DialogoConfirmacion', () => {
    @Component({
      imports: [DialogoConfirmacion],
      template: `
        <app-dialogo-confirmacion
          [abierto]="abierto()"
          titulo="¿Suspender a Ana?"
          textoConfirmar="Sí, suspender"
          [peligro]="true"
          [ocupado]="ocupado()"
          (confirmar)="confirmaciones = confirmaciones + 1"
          (cancelar)="abierto.set(false)"
        >
          <p>No recibirá nuevas solicitudes.</p>
        </app-dialogo-confirmacion>
      `,
    })
    class Anfitrion {
      readonly abierto = signal(false);
      readonly ocupado = signal(false);
      confirmaciones = 0;
    }

    function crear() {
      const fixture = TestBed.createComponent(Anfitrion);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const dialogo = el.querySelector('dialog') as HTMLDialogElement;
      const boton = (texto: string) =>
        Array.from(el.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === texto,
        ) as HTMLButtonElement;
      return { fixture, dialogo, boton };
    }

    it('abre y cierra según la entrada y se describe con título y contenido', () => {
      const { fixture, dialogo } = crear();
      expect(dialogo.hasAttribute('open')).toBe(false);

      fixture.componentInstance.abierto.set(true);
      fixture.detectChanges();
      expect(dialogo.hasAttribute('open')).toBe(true);
      const titulo = document.getElementById(dialogo.getAttribute('aria-labelledby') ?? '');
      const cuerpo = document.getElementById(dialogo.getAttribute('aria-describedby') ?? '');
      expect(titulo?.textContent).toBe('¿Suspender a Ana?');
      expect(cuerpo?.textContent).toContain('No recibirá nuevas solicitudes.');

      fixture.componentInstance.abierto.set(false);
      fixture.detectChanges();
      expect(dialogo.hasAttribute('open')).toBe(false);
    });

    it('confirma, cancela y marca la acción como peligrosa', () => {
      const { fixture, boton } = crear();
      fixture.componentInstance.abierto.set(true);
      fixture.detectChanges();

      expect(boton('Sí, suspender').classList).toContain('peligro');
      boton('Sí, suspender').click();
      expect(fixture.componentInstance.confirmaciones).toBe(1);

      boton('Cancelar').click();
      fixture.detectChanges();
      expect(fixture.componentInstance.abierto()).toBe(false);
    });

    it('Escape cancela, salvo mientras se guarda', () => {
      const { fixture, dialogo, boton } = crear();
      fixture.componentInstance.abierto.set(true);
      fixture.componentInstance.ocupado.set(true);
      fixture.detectChanges();

      expect(boton('Guardando…').disabled).toBe(true);
      const escape = new Event('cancel', { cancelable: true });
      dialogo.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBe(true);
      expect(fixture.componentInstance.abierto()).toBe(true);

      fixture.componentInstance.ocupado.set(false);
      fixture.detectChanges();
      dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
      fixture.detectChanges();
      expect(fixture.componentInstance.abierto()).toBe(false);
    });

    it('usa showModal y close cuando el navegador los tiene', () => {
      const showModal = vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      });
      const close = vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute('open');
      });
      Object.assign(HTMLElement.prototype, { showModal, close });
      try {
        const { fixture } = crear();
        fixture.componentInstance.abierto.set(true);
        fixture.detectChanges();
        expect(showModal).toHaveBeenCalledTimes(1);

        fixture.componentInstance.abierto.set(false);
        fixture.detectChanges();
        expect(close).toHaveBeenCalledTimes(1);
      } finally {
        delete (HTMLElement.prototype as Partial<HTMLDialogElement>).showModal;
        delete (HTMLElement.prototype as Partial<HTMLDialogElement>).close;
      }
    });
  });

  describe('TarjetaDetalle', () => {
    it('muestra título, subtítulo, datos con «—» si faltan y el contenido proyectado', () => {
      @Component({
        imports: [TarjetaDetalle],
        template: `
          <app-tarjeta-detalle titulo="Ana Pérez" subtitulo="Técnica" [datos]="datos">
            <span estado>Pendiente</span>
            <button acciones type="button">Aprobar</button>
          </app-tarjeta-detalle>
        `,
      })
      class Anfitrion {
        readonly datos: DatoDetalle[] = [
          { etiqueta: 'Documento', valor: '1020304050' },
          { etiqueta: 'Teléfono', valor: null },
        ];
      }
      const fixture = TestBed.createComponent(Anfitrion);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('h3')?.textContent).toBe('Ana Pérez');
      expect(el.querySelector('header p')?.textContent).toBe('Técnica');
      expect(Array.from(el.querySelectorAll('dd')).map((d) => d.textContent)).toEqual([
        '1020304050',
        '—',
      ]);
      expect(el.querySelector('header')?.textContent).toContain('Pendiente');
      expect(el.querySelector('footer button')?.textContent).toBe('Aprobar');
    });

    it('sin subtítulo no pinta el párrafo', () => {
      const fixture = TestBed.createComponent(TarjetaDetalle);
      fixture.componentRef.setInput('titulo', 'Sin datos');
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('header p')).toBeNull();
    });
  });
});
