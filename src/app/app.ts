import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { Sesion } from './core/sesion';

@Component({
  imports: [RouterOutlet, RouterLink],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly titulo = 'QUICKPATCH — Panel administrativo';
  protected readonly sesion = inject(Sesion);
  private readonly router = inject(Router);

  protected async salir(): Promise<void> {
    this.sesion.cerrar();
    await this.router.navigate(['/iniciar-sesion']);
  }
}
