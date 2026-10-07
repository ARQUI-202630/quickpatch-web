import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/**
 * Prefijo del API Gateway. El panel se sirve en el mismo nombre que la API (`quickpatch.internal`), así que basta la
 * ruta relativa; el gateway quita `/api` antes de enviar al servicio (contratos en `contracts/api-gateway/openapi/`).
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', { factory: () => '/api' });

/** Roles con acceso al panel web (DD 11.3: el panel es para administradores). */
export type RolAdministrador = 'admin_tenant' | 'admin_plataforma';

export interface Usuario {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface RespuestaLogin {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: Usuario;
}

interface SesionGuardada {
  token: string;
  venceEn: number;
  usuario: Usuario;
}

const CLAVE = 'quickpatch.sesion';

/** No es un rol del panel: los demás usan la app móvil. */
export class RolSinAccesoError extends Error {
  constructor() {
    super('Tu usuario usa la app móvil de QUICKPATCH; el panel es para administradores.');
  }
}

/**
 * Sesión del administrador. El token vive en `sessionStorage` (se borra al cerrar la pestaña) y nunca se guarda el
 * tenant aparte: sale del token (DD 11.3).
 */
@Injectable({ providedIn: 'root' })
export class Sesion {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly estado = signal<SesionGuardada | null>(Sesion.cargar());

  readonly usuario = computed(() => this.estado()?.usuario ?? null);
  readonly autenticado = computed(() => this.vigente() !== null);

  /** `POST /v1/auth/login` (identity.v1.yaml). Rechaza roles que no son de administración. */
  async iniciar(email: string, password: string): Promise<Usuario> {
    const r = await firstValueFrom(
      this.http.post<RespuestaLogin>(`${this.base}/v1/auth/login`, {
        email: email.trim(),
        password,
      }),
    );
    if (r.user.role !== 'admin_tenant' && r.user.role !== 'admin_plataforma') {
      throw new RolSinAccesoError();
    }
    const guardada: SesionGuardada = {
      token: r.accessToken,
      venceEn: Date.now() + r.expiresIn * 1000,
      usuario: r.user,
    };
    this.estado.set(guardada);
    Sesion.guardar(guardada);
    return r.user;
  }

  cerrar(): void {
    this.estado.set(null);
    Sesion.guardar(null);
  }

  /** Token vigente o `null` si no hay sesión o ya venció. */
  token(): string | null {
    return this.vigente()?.token ?? null;
  }

  tieneRol(...roles: RolAdministrador[]): boolean {
    const rol = this.vigente()?.usuario.role;
    return rol !== undefined && (roles as string[]).includes(rol);
  }

  private vigente(): SesionGuardada | null {
    const s = this.estado();
    return s && s.venceEn > Date.now() ? s : null;
  }

  private static cargar(): SesionGuardada | null {
    try {
      const texto = sessionStorage.getItem(CLAVE);
      return texto ? (JSON.parse(texto) as SesionGuardada) : null;
    } catch {
      return null;
    }
  }

  private static guardar(s: SesionGuardada | null): void {
    try {
      if (s) {
        sessionStorage.setItem(CLAVE, JSON.stringify(s));
      } else {
        sessionStorage.removeItem(CLAVE);
      }
    } catch {
      // Sin almacenamiento disponible la sesión dura lo que dure la página.
    }
  }
}
