import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { API_BASE_URL, Sesion } from './sesion';

/** `X-Correlation-Id` en cada petición a la API (AC7-E4), para seguirla en los logs de los servicios. */
export const correlacionInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  if (!req.url.startsWith(base) || req.headers.has('X-Correlation-Id')) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-Correlation-Id': crypto.randomUUID() } }));
};

/** Agrega el token y, si la API responde 401, cierra la sesión y vuelve al inicio de sesión. */
export const autenticacionInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  const sesion = inject(Sesion);
  const router = inject(Router);
  const token = sesion.token();
  const conToken =
    token && req.url.startsWith(base)
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;
  return next(conToken).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token) {
        sesion.cerrar();
        void router.navigate(['/iniciar-sesion']);
      }
      return throwError(() => error);
    }),
  );
};

const MENSAJES: Record<string, string> = {
  'credenciales-invalidas': 'El correo o la contraseña no son correctos.',
  'cuenta-bloqueada': 'Tu cuenta está bloqueada temporalmente por intentos fallidos.',
  'tenant-inactivo': 'La empresa está inactiva.',
  'canal-sin-tenant': 'El servicio no está disponible en este momento. Intenta más tarde.',
  'no-autorizado': 'No tienes permiso para hacer esta acción.',
  'no-autenticado': 'Tu sesión terminó. Vuelve a iniciar sesión.',
  'no-encontrado': 'No encontramos lo que buscas.',
  'tenant-plataforma': 'El tenant de la plataforma no se puede desactivar.',
  'nit-registrado': 'Ya existe un tenant con ese NIT.',
  'transicion-invalida':
    'El estado del técnico cambió y ya no admite esta acción. Revisa la lista actualizada.',
  validacion: 'Revisa los datos enviados.',
};

/** Traduce un error de la API (Problem Details, RFC 9457) a un mensaje para el administrador. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof Error && !(error instanceof HttpErrorResponse)) {
    return error.message;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return 'Ocurrió un error inesperado.';
  }
  if (error.status === 0) {
    return 'No hay conexión con QUICKPATCH.';
  }
  return MENSAJES[tipoDeError(error)] ?? 'Ocurrió un error inesperado.';
}

/** Último segmento del `type` de un Problem Details (`nit-registrado`, `validacion`…); vacío si no es de la API. */
export function tipoDeError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return '';
  }
  const tipo = (error.error as { type?: string } | null)?.type ?? '';
  return tipo.substring(tipo.lastIndexOf('/') + 1);
}

/** Errores por campo de un 400 (`errors` del Problem Details): el primer mensaje de cada campo. */
export function erroresDeCampo(error: unknown): Record<string, string> {
  if (!(error instanceof HttpErrorResponse)) {
    return {};
  }
  const errores = (error.error as { errors?: Record<string, string[]> } | null)?.errors ?? {};
  return Object.fromEntries(
    Object.entries(errores)
      .filter(([, mensajes]) => Array.isArray(mensajes) && mensajes.length > 0)
      .map(([campo, mensajes]) => [campo, mensajes[0]]),
  );
}
