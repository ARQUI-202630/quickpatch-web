import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { mensajeDeError } from '../../core/http';
import { Sesion } from '../../core/sesion';

/** Inicio de sesión de los administradores (RF-03). Contrato: `POST /v1/auth/login`. */
@Component({
  selector: 'app-inicio-sesion',
  imports: [ReactiveFormsModule],
  styleUrl: './inicio-sesion.scss',
  template: `
    <div class="acceso">
      <section class="presentacion" aria-labelledby="marca-acceso">
        <div class="marca">
          <span class="sello" aria-hidden="true">Q</span>
          <h1 id="marca-acceso">QUICKPATCH <span>Panel administrativo</span></h1>
        </div>
        <div class="mensaje">
          <p class="destacado">La administración de QUICKPATCH, en un solo lugar.</p>
          <dl>
            <dt>Administrador de plataforma</dt>
            <dd>Empresas oferentes (tenants): alta, activación y desactivación.</dd>
            <dt>Administrador de empresa</dt>
            <dd>Técnicos, catálogo de servicios y reportes de tu empresa.</dd>
          </dl>
        </div>
        <p class="pie">Técnicos y clientes usan la app móvil de QUICKPATCH.</p>
      </section>

      <section class="formulario" aria-labelledby="titulo-acceso">
        <div class="caja">
          <h2 id="titulo-acceso">Iniciar sesión</h2>
          <p class="nota">Ingresa con tu cuenta de administrador.</p>
          <form [formGroup]="formulario" (ngSubmit)="enviar()" novalidate>
            <div class="campo">
              <label for="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                autocomplete="username"
                placeholder="nombre@empresa.co"
                [attr.aria-invalid]="invalido('email') || null"
                [attr.aria-describedby]="invalido('email') ? 'email-error' : null"
              />
              @if (invalido('email')) {
                <p class="error-campo" id="email-error">Escribe un correo válido.</p>
              }
            </div>

            <div class="campo">
              <label for="password">Contraseña</label>
              <input
                id="password"
                type="password"
                formControlName="password"
                autocomplete="current-password"
                [attr.aria-invalid]="invalido('password') || null"
                [attr.aria-describedby]="invalido('password') ? 'password-error' : null"
              />
              @if (invalido('password')) {
                <p class="error-campo" id="password-error">Escribe tu contraseña.</p>
              }
            </div>

            @if (error()) {
              <p class="alerta" role="alert">{{ error() }}</p>
            }
            <button type="submit" [disabled]="enviando()" [attr.aria-busy]="enviando()">
              {{ enviando() ? 'Ingresando…' : 'Ingresar' }}
            </button>
          </form>
        </div>
      </section>
    </div>
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

  protected invalido(campo: 'email' | 'password'): boolean {
    const control = this.formulario.controls[campo];
    return control.touched && control.invalid;
  }

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
