import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { mensajeDeError } from '../../core/http';
import { Sesion } from '../../core/sesion';

/** Inicio de sesión de los administradores (RF-03). Contrato: `POST /v1/auth/login`. */
@Component({
  selector: 'app-inicio-sesion',
  imports: [ReactiveFormsModule],
  template: `
    <section class="tarjeta">
      <h2>Iniciar sesión</h2>
      <form [formGroup]="formulario" (ngSubmit)="enviar()" novalidate>
        <label for="email">Correo electrónico</label>
        <input id="email" type="email" formControlName="email" autocomplete="username" />
        @if (formulario.controls.email.touched && formulario.controls.email.invalid) {
          <p class="error-campo">Escribe un correo válido.</p>
        }

        <label for="password">Contraseña</label>
        <input
          id="password"
          type="password"
          formControlName="password"
          autocomplete="current-password"
        />
        @if (formulario.controls.password.touched && formulario.controls.password.invalid) {
          <p class="error-campo">Escribe tu contraseña.</p>
        }

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <button type="submit" [disabled]="enviando()">
          {{ enviando() ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>
    </section>
  `,
})
export class InicioSesion {
  private readonly sesion = inject(Sesion);
  private readonly router = inject(Router);

  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  async enviar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    try {
      const { email, password } = this.formulario.getRawValue();
      const usuario = await this.sesion.iniciar(email, password);
      await this.router.navigate([usuario.role === 'admin_plataforma' ? '/tenants' : '/inicio']);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.enviando.set(false);
    }
  }
}
