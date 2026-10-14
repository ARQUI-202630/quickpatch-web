import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, skip } from 'rxjs';

import { RolAdministrador, Sesion } from './core/sesion';
import { Icono, NombreIcono } from './shared/icono';

interface Enlace {
  ruta: string;
  etiqueta: string;
  icono: NombreIcono;
  roles: readonly RolAdministrador[];
}

/** Navegación principal: cada enlace solo aparece para los roles que su ruta admite (app.routes.ts). */
const ENLACES: readonly Enlace[] = [
  { ruta: '/inicio', etiqueta: 'Inicio', icono: 'inicio', roles: ['admin_tenant'] },
  { ruta: '/tecnicos', etiqueta: 'Técnicos', icono: 'tecnicos', roles: ['admin_tenant'] },
  { ruta: '/tenants', etiqueta: 'Tenants', icono: 'tenants', roles: ['admin_plataforma'] },
];

const NOMBRE_ROL: Record<RolAdministrador, string> = {
  admin_plataforma: 'Administrador de plataforma',
  admin_tenant: 'Administrador de empresa',
};

/** Ancho desde el que la barra lateral queda fija (debe coincidir con $angosto en app.scss). */
const ANCHO_BARRA_FIJA = '(min-width: 56.01rem)';

/**
 * Shell del panel (SCRUM-435). Con sesión: barra lateral con la navegación por rol y encabezado con el usuario; en
 * pantallas angostas la barra se vuelve un panel deslizable. Sin sesión: solo la marca y el contenido.
 *
 * Foco (SCRUM-438): al abrir el panel deslizable el foco pasa a «Cerrar menú» y el resto queda inerte; al cerrarlo
 * vuelve a «Abrir menú». Al cambiar de ruta el foco pasa al contenido para que el lector de pantalla empiece ahí.
 */
@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
  host: { '(document:keydown.escape)': 'cerrarMenu()' },
})
export class App {
  protected readonly sesion = inject(Sesion);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly botonAbrir = viewChild<ElementRef<HTMLButtonElement>>('botonAbrir');
  private readonly botonCerrar = viewChild<ElementRef<HTMLButtonElement>>('botonCerrar');

  protected readonly menuAbierto = signal(false);
  protected readonly enlaces = computed(() =>
    ENLACES.filter((e) => this.sesion.tieneRol(...e.roles)),
  );
  protected readonly nombreRol = computed(() => {
    const rol = this.sesion.usuario()?.role;
    return rol === 'admin_plataforma' || rol === 'admin_tenant' ? NOMBRE_ROL[rol] : '';
  });
  protected readonly iniciales = computed(() =>
    (this.sesion.usuario()?.fullName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join(''),
  );

  constructor() {
    const navegaciones = this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        skip(1), // la carga inicial no mueve el foco
      )
      .subscribe(() => this.enfocarDespues(() => document.getElementById('contenido')));
    inject(DestroyRef).onDestroy(() => navegaciones.unsubscribe());

    // Si la ventana se ensancha con el panel abierto, se cierra para no dejar el contenido inerte.
    const ancho = typeof matchMedia === 'function' ? matchMedia(ANCHO_BARRA_FIJA) : null;
    const alEnsanchar = (e: MediaQueryListEvent) => e.matches && this.menuAbierto.set(false);
    ancho?.addEventListener('change', alEnsanchar);
    inject(DestroyRef).onDestroy(() => ancho?.removeEventListener('change', alEnsanchar));
  }

  protected alternarMenu(): void {
    if (this.menuAbierto()) {
      this.cerrarMenu();
      return;
    }
    this.menuAbierto.set(true);
    this.enfocarDespues(() => this.botonCerrar()?.nativeElement);
  }

  protected cerrarMenu(): void {
    if (!this.menuAbierto()) {
      return;
    }
    this.menuAbierto.set(false);
    this.enfocarDespues(() => this.botonAbrir()?.nativeElement);
  }

  private enfocarDespues(elemento: () => HTMLElement | null | undefined): void {
    afterNextRender(() => elemento()?.focus(), { injector: this.injector });
  }

  protected async salir(): Promise<void> {
    this.cerrarMenu();
    this.sesion.cerrar();
    await this.router.navigate(['/iniciar-sesion']);
  }
}
