import { Location } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { erroresDeCampo, mensajeDeError, tipoDeError } from '../../core/http';
import { ActivacionApi, tokenDeFragmento } from './activacion-api';

type Estado = 'formulario' | 'activada' | 'invalido';

/** Misma política que el registro y el contrato (`PasswordSetupRequest`): de 8 a 128 caracteres. */
const CONTRASENA_MIN = 8;
const CONTRASENA_MAX = 128;

function coinciden(grupo: AbstractControl): ValidationErrors | null {
  const { password, confirmacion } = grupo.value as { password: string; confirmacion: string };
  return confirmacion && password !== confirmacion ? { distintas: true } : null;
}

/**
 * Activación de la cuenta de un técnico del equipo de un proveedor (SCRUM-463, identity 1.7.0).
 *
 * El proveedor le comparte `https://<host>/activar#token=…`. En el teléfono, el dominio privado no se puede
 * verificar para abrir la app, así que el enlace termina aquí: esta página funciona siempre y la app es un
 * atajo (SCRUM-98). Es pública. El token sale del fragmento, que el navegador nunca envía al servidor; se
 * quita de la barra de direcciones al leerlo y solo viaja en el cuerpo del `POST`.
 */
@Component({
  selector: 'app-activar-cuenta',
  imports: [ReactiveFormsModule],
  styleUrl: './activar-cuenta.scss',
  template: `
    <div class="activacion">
      <div class="caja">
        <div class="marca">
          <span class="sello" aria-hidden="true">Q</span>
          <span class="nombre-marca">QUICKPATCH</span>
        </div>

        @switch (estado()) {
          @case ('formulario') {
            <h1 id="titulo-activacion">Activa tu cuenta</h1>
            <p class="nota">
              Tu proveedor te agregó a su equipo. Define tu contraseña para entrar a la app.
            </p>
            <form
              [formGroup]="formulario"
              (ngSubmit)="enviar()"
              novalidate
              aria-labelledby="titulo-activacion"
            >
              <div class="campo">
                <label for="password">Contraseña nueva</label>
                <input
                  #campoPassword
                  id="password"
                  type="password"
                  formControlName="password"
                  autocomplete="new-password"
                  [attr.maxlength]="contrasenaMax"
                  [attr.aria-invalid]="errorPassword() !== null || null"
                  [attr.aria-describedby]="
                    errorPassword() ? 'password-error password-ayuda' : 'password-ayuda'
                  "
                />
                <span id="password-ayuda" class="ayuda"
                  >Al menos {{ contrasenaMin }} caracteres.</span
                >
                @if (errorPassword(); as mensaje) {
                  <p class="error-campo" id="password-error">{{ mensaje }}</p>
                }
              </div>

              <div class="campo">
                <label for="confirmacion">Confirma la contraseña</label>
                <input
                  id="confirmacion"
                  type="password"
                  formControlName="confirmacion"
                  autocomplete="new-password"
                  [attr.aria-invalid]="errorConfirmacion() !== null || null"
                  [attr.aria-describedby]="errorConfirmacion() ? 'confirmacion-error' : null"
                />
                @if (errorConfirmacion(); as mensaje) {
                  <p class="error-campo" id="confirmacion-error">{{ mensaje }}</p>
                }
              </div>

              @if (error(); as mensaje) {
                <p class="alerta" role="alert">{{ mensaje }}</p>
              }
              <button type="submit" [disabled]="enviando()" [attr.aria-busy]="enviando()">
                {{ enviando() ? 'Activando…' : 'Activar cuenta' }}
              </button>
            </form>
          }
          @case ('activada') {
            <div class="resultado exito" role="status">
              <h1 #tituloResultado tabindex="-1">Tu cuenta quedó activa</h1>
              <p>
                Abre la app de QUICKPATCH e inicia sesión con tu correo y la contraseña que acabas
                de definir.
              </p>
            </div>
          }
          @case ('invalido') {
            <div class="resultado invalido">
              <h1 #tituloResultado tabindex="-1">Este enlace ya no sirve</h1>
              <p>El enlace ya se usó, venció o fue reemplazado. Pídele uno nuevo a tu proveedor.</p>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class ActivarCuenta {
  private readonly api = inject(ActivacionApi);
  private readonly injector = inject(Injector);

  /** Token leído del fragmento; `null` si falta o está mal formado. */
  private readonly token = tokenDeFragmento(inject(ActivatedRoute).snapshot.fragment);

  protected readonly estado = signal<Estado>(this.token ? 'formulario' : 'invalido');
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly contrasenaMin = CONTRASENA_MIN;
  protected readonly contrasenaMax = CONTRASENA_MAX;
  protected readonly formulario = inject(FormBuilder).nonNullable.group(
    {
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(CONTRASENA_MIN),
          Validators.maxLength(CONTRASENA_MAX),
        ],
      ],
      confirmacion: ['', Validators.required],
    },
    { validators: coinciden },
  );
  /** Error de `errors.password` que devolvió la API; se borra al editar la contraseña. */
  private readonly errorServidor = signal<string | null>(null);
  /** Cambia con cada edición o envío para recalcular los mensajes. */
  private readonly version = signal(0);
  private readonly campoPassword = viewChild<ElementRef<HTMLInputElement>>('campoPassword');
  private readonly tituloResultado = viewChild<ElementRef<HTMLElement>>('tituloResultado');

  constructor() {
    // El token no se queda en la barra de direcciones ni en el historial.
    inject(Location).replaceState('/activar');
    this.formulario.valueChanges.subscribe(() => this.version.update((v) => v + 1));
    this.formulario.controls.password.valueChanges.subscribe(() => this.errorServidor.set(null));
  }

  protected errorPassword(): string | null {
    this.version();
    const servidor = this.errorServidor();
    if (servidor) {
      return servidor;
    }
    const control = this.formulario.controls.password;
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required')
      ? 'Escribe tu contraseña.'
      : `Usa entre ${CONTRASENA_MIN} y ${CONTRASENA_MAX} caracteres.`;
  }

  protected errorConfirmacion(): string | null {
    this.version();
    const control = this.formulario.controls.confirmacion;
    if (!control.touched) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Confirma tu contraseña.';
    }
    return this.formulario.hasError('distintas') ? 'Las contraseñas no coinciden.' : null;
  }

  async enviar(): Promise<void> {
    this.formulario.markAllAsTouched();
    this.version.update((v) => v + 1);
    if (this.formulario.invalid || !this.token) {
      this.campoPassword()?.nativeElement.focus();
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.definirContrasena(this.token, this.formulario.getRawValue().password),
      );
      this.mostrarResultado('activada');
    } catch (e) {
      const tipo = tipoDeError(e);
      const password = erroresDeCampo(e)['password'];
      if (tipo === 'enlace-invalido') {
        this.mostrarResultado('invalido');
      } else if (tipo === 'validacion' && password) {
        this.errorServidor.set(password);
        this.campoPassword()?.nativeElement.focus();
      } else {
        this.error.set(mensajeDeError(e));
      }
    } finally {
      this.enviando.set(false);
    }
  }

  /** Cambia la vista y lleva el foco al título, para que el lector de pantalla lo anuncie. */
  private mostrarResultado(estado: Estado): void {
    this.estado.set(estado);
    afterNextRender(() => this.tituloResultado()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }
}
