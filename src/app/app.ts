import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

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
  { ruta: '/tenants', etiqueta: 'Tenants', icono: 'tenants', roles: ['admin_plataforma'] },
];

const NOMBRE_ROL: Record<RolAdministrador, string> = {
  admin_plataforma: 'Administrador de plataforma',
  admin_tenant: 'Administrador de empresa',
};

/**
 * Shell del panel (SCRUM-435). Con sesión: barra lateral con la navegación por rol y encabezado con el usuario; en
 * pantallas angostas la barra se vuelve un panel deslizable. Sin sesión: solo la marca y el contenido.
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

  protected alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  protected cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  protected async salir(): Promise<void> {
    this.cerrarMenu();
    this.sesion.cerrar();
    await this.router.navigate(['/iniciar-sesion']);
  }
}
