import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { RolAdministrador, Sesion } from './sesion';

/**
 * Permite la ruta solo con sesión vigente y uno de los roles indicados (SCRUM-25: el panel protege sus rutas; el
 * backend vuelve a validar el rol en cada endpoint). Sin sesión lleva al inicio de sesión; con otro rol, al inicio.
 */
export function requiereRol(...roles: RolAdministrador[]): CanActivateFn {
  return () => {
    const sesion = inject(Sesion);
    const router = inject(Router);
    if (!sesion.autenticado()) {
      return router.createUrlTree(['/iniciar-sesion']);
    }
    return sesion.tieneRol(...roles) ? true : router.createUrlTree(['/inicio']);
  };
}

/** Destino inicial según el rol: el administrador de la plataforma va a los tenants. */
export const redirigirPorRol: CanActivateFn = () => {
  const sesion = inject(Sesion);
  const router = inject(Router);
  if (!sesion.autenticado()) {
    return router.createUrlTree(['/iniciar-sesion']);
  }
  return router.createUrlTree([sesion.tieneRol('admin_plataforma') ? '/tenants' : '/inicio']);
};
