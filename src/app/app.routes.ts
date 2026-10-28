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
    // Pública: el técnico abre aquí el enlace de su invitación (SCRUM-463).
    path: 'activar',
    title: 'Activa tu cuenta · QUICKPATCH',
    loadComponent: () =>
      import('./features/activacion/activar-cuenta').then((m) => m.ActivarCuenta),
  },
  {
    path: 'inicio',
    title: 'Inicio · QUICKPATCH',
    canActivate: [requiereRol('admin_tenant', 'admin_plataforma')],
    loadComponent: () => import('./features/inicio/inicio').then((m) => m.Inicio),
  },
  {
    path: 'tecnicos',
    title: 'Técnicos · QUICKPATCH',
    canActivate: [requiereRol('admin_tenant')],
    loadComponent: () => import('./features/tecnicos/tecnicos').then((m) => m.Tecnicos),
  },
  {
    path: 'solicitudes',
    title: 'Solicitudes · QUICKPATCH',
    canActivate: [requiereRol('admin_tenant', 'admin_plataforma')],
    loadComponent: () => import('./features/solicitudes/solicitudes').then((m) => m.Solicitudes),
  },
  {
    path: 'tenants',
    title: 'Tenants · QUICKPATCH',
    canActivate: [requiereRol('admin_plataforma')],
    loadComponent: () => import('./features/tenants/tenants').then((m) => m.Tenants),
  },
  {
    // Pública: presentación del proyecto (SCRUM-491). Con sesión, el guard lleva al panel.
    path: '',
    pathMatch: 'full',
    title: 'QUICKPATCH · Servicios técnicos para el hogar y las empresas en Bogotá',
    canActivate: [redirigirPorRol],
    loadComponent: () => import('./features/presentacion/presentacion').then((m) => m.Presentacion),
  },
  { path: '**', redirectTo: '' },
];
