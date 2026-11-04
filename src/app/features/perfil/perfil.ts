import { Location } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { erroresDeCampo, mensajeDeError } from '../../core/http';
import { Sesion, nombreDeRol } from '../../core/sesion';
import { DialogoConfirmacion } from '../../shared/dialogo-confirmacion';
import { Icono } from '../../shared/icono';
import { CambiosPerfil, Perfil, PerfilApi } from './perfil-api';

type CampoPerfil = 'fullName' | 'phone';

/** Límites de `PATCH /v1/users/me` (identity.v1.yaml 1.9.0). */
const NOMBRE_MIN = 2;
const NOMBRE_MAX = 150;
const TELEFONO_MIN = 7;
const TELEFONO_MAX = 30;

/** Obligatorio aunque se escriban solo espacios, que no se envían. */
function requerido(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim().length === 0 ? { required: true } : null;
}

/** Longitud sin los espacios de los extremos, que no se envían; vacío lo decide `requerido`. */
function longitud(min: number, max: number) {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const largo = control.value.trim().length;
    return largo > 0 && (largo < min || largo > max) ? { longitud: true } : null;
  };
}

/**
 * Perfil propio del administrador (SCRUM-609 / SCRUM-613): `GET` y `PATCH /v1/users/me`. Solo se editan el nombre y el
 * teléfono; el correo y el rol se muestran sin poder cambiarlos. Al guardar, el nombre nuevo pasa a la sesión y al
 * encabezado sin volver a iniciar sesión. Salir con cambios sin guardar pide confirmación.
 */
@Component({
  selector: 'app-mi-perfil',
  imports: [ReactiveFormsModule, DialogoConfirmacion, Icono],
  styleUrl: './perfil.scss',
  template: `
    <div class="pagina">
      <button type="button" class="volver enlace" (click)="volver()">
        <app-icono nombre="flecha" [tamano]="18" />
        Volver
      </button>
      <header class="encabezado-pagina">
        <div>
          <h2>Mi perfil</h2>
          <p>Tus datos personales. El correo y el rol no se pueden cambiar.</p>
        </div>
      </header>

      <p class="aviso" role="status">{{ aviso() }}</p>

      <section class="tarjeta" aria-labelledby="titulo-datos" [attr.aria-busy]="cargando()">
        <h3 id="titulo-datos" class="visualmente-oculto">Datos del perfil</h3>
        @if (cargando()) {
          <p class="nota">Cargando tu perfil…</p>
        } @else if (perfil(); as p) {
          <dl class="fijos">
            <div>
              <dt>Correo</dt>
              <dd>
                {{ p.email }}
                <app-icono nombre="candado" [tamano]="16" />
                <span class="visualmente-oculto">(no se puede cambiar)</span>
              </dd>
            </div>
            <div>
              <dt>Rol</dt>
              <dd>
                {{ nombreRol() }}
                <app-icono nombre="candado" [tamano]="16" />
                <span class="visualmente-oculto">(no se puede cambiar)</span>
              </dd>
            </div>
          </dl>

          <form [formGroup]="formulario" (ngSubmit)="guardar()" novalidate>
            <div class="campo">
              <label for="perfil-nombre">Nombre completo</label>
              <input
                #campoNombre
                id="perfil-nombre"
                type="text"
                formControlName="fullName"
                autocomplete="name"
                [attr.maxlength]="nombreMax"
                [attr.aria-invalid]="errorCampo('fullName') !== null || null"
                [attr.aria-describedby]="errorCampo('fullName') ? 'perfil-nombre-error' : null"
              />
              @if (errorCampo('fullName'); as mensaje) {
                <p id="perfil-nombre-error" class="error-campo">{{ mensaje }}</p>
              }
            </div>
            <div class="campo">
              <label for="perfil-telefono">Teléfono (opcional)</label>
              <input
                #campoTelefono
                id="perfil-telefono"
                type="tel"
                formControlName="phone"
                autocomplete="tel"
                [attr.maxlength]="telefonoMax"
                [attr.aria-invalid]="errorCampo('phone') !== null || null"
                [attr.aria-describedby]="errorCampo('phone') ? 'perfil-telefono-error' : null"
              />
              @if (errorCampo('phone'); as mensaje) {
                <p id="perfil-telefono-error" class="error-campo">{{ mensaje }}</p>
              }
            </div>
            @if (error()) {
              <p class="alerta" role="alert">{{ error() }}</p>
            }
            <button
              type="submit"
              [disabled]="!hayCambios() || guardando()"
              [attr.aria-busy]="guardando()"
            >
              {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
            </button>
          </form>
        } @else {
          <div class="vacio">
            <p class="alerta" role="alert">{{ error() }}</p>
            <button type="button" class="secundario" (click)="cargar()">Reintentar</button>
          </div>
        }
      </section>

      <app-dialogo-confirmacion
        [abierto]="confirmandoSalida()"
        titulo="¿Salir sin guardar?"
        textoConfirmar="Salir"
        textoCancelar="Seguir aquí"
        [peligro]="true"
        (confirmar)="responderSalida(true)"
        (cancelar)="responderSalida(false)"
      >
        <p>Los cambios de tu perfil no se han guardado.</p>
      </app-dialogo-confirmacion>
    </div>
  `,
})
export class MiPerfil implements OnInit {
  private readonly api = inject(PerfilApi);
  private readonly sesion = inject(Sesion);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  protected readonly perfil = signal<Perfil | null>(null);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal('');
  protected readonly confirmandoSalida = signal(false);
  protected readonly nombreMax = NOMBRE_MAX;
  protected readonly telefonoMax = TELEFONO_MAX;
  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    fullName: ['', [requerido, longitud(NOMBRE_MIN, NOMBRE_MAX)]],
    phone: ['', [longitud(TELEFONO_MIN, TELEFONO_MAX)]],
  });
  /** Errores que devolvió la API por campo (400 `errors`); se borran al editar el campo. */
  private readonly erroresServidor = signal<Partial<Record<CampoPerfil, string>>>({});
  /** Cambia con cada edición o envío para que los `computed` lean el formulario actual. */
  private readonly version = signal(0);
  private readonly campoNombre = viewChild<ElementRef<HTMLInputElement>>('campoNombre');
  private readonly campoTelefono = viewChild<ElementRef<HTMLInputElement>>('campoTelefono');
  private respuestaSalida: ((salir: boolean) => void) | null = null;

  protected readonly nombreRol = computed(() => nombreDeRol(this.perfil()?.role));
  protected readonly cambios = computed<CambiosPerfil>(() => {
    this.version();
    const p = this.perfil();
    if (!p) {
      return {};
    }
    const { fullName, phone } = this.formulario.getRawValue();
    const nombre = fullName.trim();
    const telefono = phone.trim();
    const telefonoActual = p.phone ?? '';
    return {
      ...(nombre !== p.fullName ? { fullName: nombre } : {}),
      ...(telefono !== telefonoActual ? { phone: telefono === '' ? null : telefono } : {}),
    };
  });
  protected readonly hayCambios = computed(() => Object.keys(this.cambios()).length > 0);

  constructor() {
    for (const campo of ['fullName', 'phone'] as const) {
      this.formulario.controls[campo].valueChanges.subscribe(() => {
        this.erroresServidor.update((errores) => ({ ...errores, [campo]: undefined }));
        this.aviso.set('');
        this.version.update((v) => v + 1);
      });
    }
  }

  ngOnInit(): Promise<void> {
    return this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.mostrar(await firstValueFrom(this.api.obtener()));
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async guardar(): Promise<void> {
    this.formulario.markAllAsTouched();
    this.version.update((v) => v + 1);
    if (!this.hayCambios() || this.guardando()) {
      return;
    }
    if (this.formulario.invalid) {
      this.enfocarPrimerError();
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      const actualizado = await firstValueFrom(this.api.actualizar(this.cambios()));
      this.mostrar(actualizado);
      this.sesion.actualizarNombre(actualizado.fullName);
      this.aviso.set('Perfil actualizado.');
    } catch (e) {
      const errores = erroresDeCampo(e);
      const campos: Partial<Record<CampoPerfil, string>> = {};
      for (const campo of ['fullName', 'phone'] as const) {
        if (errores[campo]) {
          campos[campo] = errores[campo];
        }
      }
      this.erroresServidor.set(campos);
      if (Object.keys(campos).length === 0) {
        this.error.set(mensajeDeError(e));
      }
      this.version.update((v) => v + 1);
      this.enfocarPrimerError();
    } finally {
      this.guardando.set(false);
    }
  }

  /** Mensaje del campo: primero el de la API; los de la página, cuando el campo ya se tocó o se intentó enviar. */
  protected errorCampo(campo: CampoPerfil): string | null {
    this.version();
    const servidor = this.erroresServidor()[campo];
    if (servidor) {
      return servidor;
    }
    const control = this.formulario.controls[campo];
    if (!control.touched || control.valid) {
      return null;
    }
    if (campo === 'fullName') {
      return control.hasError('required')
        ? 'Escribe tu nombre.'
        : `El nombre debe tener entre ${NOMBRE_MIN} y ${NOMBRE_MAX} caracteres.`;
    }
    return `El teléfono debe tener entre ${TELEFONO_MIN} y ${TELEFONO_MAX} caracteres.`;
  }

  /** Vuelve a la página anterior del panel; si se entró directo, al inicio que le corresponde al rol. */
  protected volver(): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
    } else {
      void this.router.navigateByUrl('/');
    }
  }

  /** `canDeactivate` de la ruta: sin cambios sale; con cambios espera la respuesta del diálogo. */
  puedeSalir(): boolean | Promise<boolean> {
    if (!this.hayCambios()) {
      return true;
    }
    this.confirmandoSalida.set(true);
    return new Promise((resolver) => (this.respuestaSalida = resolver));
  }

  protected responderSalida(salir: boolean): void {
    this.confirmandoSalida.set(false);
    this.respuestaSalida?.(salir);
    this.respuestaSalida = null;
  }

  private mostrar(perfil: Perfil): void {
    this.perfil.set(perfil);
    this.formulario.setValue({ fullName: perfil.fullName, phone: perfil.phone ?? '' });
    this.formulario.markAsUntouched();
    this.erroresServidor.set({});
    this.version.update((v) => v + 1);
  }

  private enfocarPrimerError(): void {
    const campo = this.errorCampo('fullName')
      ? this.campoNombre()
      : this.errorCampo('phone')
        ? this.campoTelefono()
        : null;
    campo?.nativeElement.focus();
  }
}
