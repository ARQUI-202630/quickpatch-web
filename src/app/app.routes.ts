import { Routes } from '@angular/router';

import { redirigirPorRol, requiereRol } from './core/guards';

export const routes: Routes = [
  {
    path: 'iniciar-sesion',
    title: 'Iniciar sesión · QUICKPATCH',
    loadComponent: () =>
      import('./features/autenticacion/inicio-sesion').then((m) => m.InicioSesion),
  },
  {
    path: 'inicio',
    title: 'Inicio · QUICKPATCH',
    canActivate: [requiereRol('admin_tenant', 'admin_plataforma')],
    loadComponent: () => import('./features/inicio/inicio').then((m) => m.Inicio),
  },
  {
    path: 'tenants',
    title: 'Tenants · QUICKPATCH',
    canActivate: [requiereRol('admin_plataforma')],
    loadComponent: () => import('./features/tenants/tenants').then((m) => m.Tenants),
  },
  { path: '', pathMatch: 'full', canActivate: [redirigirPorRol], children: [] },
  { path: '**', redirectTo: '' },
];
