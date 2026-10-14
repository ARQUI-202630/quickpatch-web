import { DatePipe } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { erroresDeCampo, mensajeDeError, tipoDeError } from '../../core/http';
import { CampoBusqueda, coincide } from '../../shared/campo-busqueda';
import { DialogoConfirmacion } from '../../shared/dialogo-confirmacion';
import { Insignia } from '../../shared/insignia';
import { EstadoTenant, Tenant, TenantsApi } from './tenants-api';

interface CambioPendiente {
  tenant: Tenant;
  nuevo: EstadoTenant;
}

type CampoTenant = 'name' | 'nit';

/** Límites de `CreateTenantRequest` (identity.v1.yaml 1.5.0). */
const NOMBRE_MIN = 2;
const NOMBRE_MAX = 150;
const NIT_MIN = 5;
const NIT_MAX = 30;
const NIT_FORMATO = /^[0-9]+(-[0-9])?$/;

/** Longitud sin los espacios de los extremos, que no se envían. */
function longitud(min: number, max: number) {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const largo = control.value.trim().length;
    return largo > 0 && (largo < min || largo > max) ? { longitud: true } : null;
  };
}

function formatoNit(control: AbstractControl<string>): ValidationErrors | null {
  const nit = control.value.trim();
  return nit.length > 0 && !NIT_FORMATO.test(nit) ? { formato: true } : null;
}

/**
 * Gestión de tenants (RF-21, SCRUM-41): lista todos los tenants, los filtra por nombre o NIT sobre la lista ya
 * cargada y permite activarlos o desactivarlos con un diálogo de confirmación. Un tenant inactivo no puede registrar
 * usuarios ni iniciar sesión (RN-T1). También crea tenants con nombre y NIT (SCRUM-61), que nacen activos; sus
 * usuarios y su canal se configuran aparte (RN-U5).
 */
@Component({
  selector: 'app-tenants',
  imports: [DatePipe, ReactiveFormsModule, CampoBusqueda, DialogoConfirmacion, Insignia],
  styleUrl: './tenants.scss',
  template: `
    <div class="pagina">
      <header class="encabezado-pagina">
        <div>
          <h2>Tenants</h2>
          <p>
            Empresas oferentes de la plataforma. Un tenant inactivo no puede registrar usuarios ni
            iniciar sesión.
          </p>
        </div>
        <div class="lado">
          @if (!cargando() && tenants().length > 0) {
            <p class="resumen numerico">
              <span
                ><strong>{{ activos() }}</strong> {{ activos() === 1 ? 'activo' : 'activos' }}</span
              >
              <span
                ><strong>{{ inactivos() }}</strong>
                {{ inactivos() === 1 ? 'inactivo' : 'inactivos' }}</span
              >
            </p>
          }
          <button type="button" [disabled]="cargando()" (click)="abrirCreacion()">
            Nuevo tenant
          </button>
        </div>
      </header>

      @if (error() && !pendiente() && !creando()) {
        <p class="alerta" role="alert">{{ error() }}</p>
      }
      <p class="aviso" role="status">{{ aviso() }}</p>

      <section class="tarjeta contenedor-tabla">
        @if (!cargando() && tenants().length > 0) {
          <div class="herramientas">
            <app-campo-busqueda
              etiqueta="Buscar tenants por nombre o NIT"
              placeholder="Buscar por nombre o NIT"
              [(valor)]="consulta"
            />
          </div>
        }
        <table [attr.aria-busy]="cargando()">
          <caption class="oculto">
            Empresas oferentes de la plataforma
          </caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">NIT</th>
              <th scope="col">Estado</th>
              <th scope="col">Creado</th>
              <th scope="col"><span class="oculto">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            @if (cargando()) {
              @for (fila of filasEsqueleto; track fila) {
                <tr class="fila-esqueleto" aria-hidden="true">
                  <td><span class="esqueleto ancho-lg"></span></td>
                  <td><span class="esqueleto ancho-md"></span></td>
                  <td><span class="esqueleto ancho-sm"></span></td>
                  <td><span class="esqueleto ancho-md"></span></td>
                  <td></td>
                </tr>
              }
            } @else {
              @for (t of filtrados(); track t.id) {
                <tr>
                  <td class="nombre" data-etiqueta="Nombre">{{ t.name }}</td>
                  <td data-etiqueta="NIT">{{ t.nit }}</td>
                  <td data-etiqueta="Estado">
                    <app-insignia [tono]="t.status === 'activo' ? 'exito' : 'peligro'">{{
                      t.status === 'activo' ? 'Activo' : 'Inactivo'
                    }}</app-insignia>
                  </td>
                  <td data-etiqueta="Creado">
                    <time [attr.datetime]="t.createdAt">{{
                      t.createdAt | date: 'dd/MM/yyyy'
                    }}</time>
                  </td>
                  <td class="acciones">
                    <button
                      type="button"
                      class="secundario"
                      [class.peligro]="t.status === 'activo'"
                      (click)="pedirCambio(t)"
                    >
                      {{ t.status === 'activo' ? 'Desactivar' : 'Activar' }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">
                    @if (tenants().length === 0) {
                      <div class="vacio">
                        <strong>No hay tenants registrados.</strong>
                        <span>Crea la primera empresa oferente con «Nuevo tenant».</span>
                      </div>
                    } @else {
                      <div class="vacio">
                        <strong>Ningún tenant coincide con «{{ consulta() }}».</strong>
                        <button type="button" class="secundario" (click)="consulta.set('')">
                          Limpiar búsqueda
                        </button>
                      </div>
                    }
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
        @if (cargando()) {
          <p class="oculto" role="status">Cargando tenants…</p>
        }
      </section>

      <app-dialogo-confirmacion
        [abierto]="pendiente() !== null"
        [titulo]="tituloDialogo()"
        [textoConfirmar]="pendiente()?.nuevo === 'activo' ? 'Sí, activar' : 'Sí, desactivar'"
        [peligro]="pendiente()?.nuevo === 'inactivo'"
        [ocupado]="guardando()"
        (confirmar)="confirmar()"
        (cancelar)="cancelarCambio()"
      >
        <p>
          @if (pendiente()?.nuevo === 'inactivo') {
            Sus usuarios no podrán registrarse ni iniciar sesión hasta que lo actives de nuevo.
          } @else {
            Sus usuarios podrán registrarse e iniciar sesión de nuevo.
          }
        </p>
        @if (error() && pendiente()) {
          <p class="alerta" role="alert">{{ error() }}</p>
        }
      </app-dialogo-confirmacion>

      <app-dialogo-confirmacion
        [abierto]="creando()"
        titulo="Nuevo tenant"
        textoConfirmar="Crear tenant"
        [ocupado]="guardando()"
        (confirmar)="crearTenant()"
        (cancelar)="cerrarCreacion()"
      >
        <p>Se crea activo. Sus usuarios y su canal se configuran aparte.</p>
        <div class="campos" [formGroup]="formulario">
          <div class="campo">
            <label for="tenant-nombre">Nombre de la empresa</label>
            <input
              #campoNombre
              id="tenant-nombre"
              type="text"
              formControlName="name"
              (keydown.enter)="enviarConEnter($event)"
              autocomplete="organization"
              [attr.maxlength]="nombreMax"
              [attr.aria-invalid]="errorCampo('name') !== null || null"
              [attr.aria-describedby]="
                errorCampo('name')
                  ? 'tenant-nombre-error tenant-nombre-cuenta'
                  : 'tenant-nombre-cuenta'
              "
            />
            <span id="tenant-nombre-cuenta" class="numerico"
              >{{ largoNombre() }}/{{ nombreMax }}</span
            >
            @if (errorCampo('name'); as mensaje) {
              <p id="tenant-nombre-error" class="error-campo">{{ mensaje }}</p>
            }
          </div>
          <div class="campo">
            <label for="tenant-nit">NIT</label>
            <input
              #campoNit
              id="tenant-nit"
              type="text"
              formControlName="nit"
              (keydown.enter)="enviarConEnter($event)"
              autocomplete="off"
              spellcheck="false"
              [attr.maxlength]="nitMax"
              [attr.aria-invalid]="errorCampo('nit') !== null || null"
              [attr.aria-describedby]="
                errorCampo('nit') ? 'tenant-nit-error tenant-nit-ayuda' : 'tenant-nit-ayuda'
              "
            />
            <span id="tenant-nit-ayuda"
              >Ej. 900123456-7. El dígito de verificación es opcional.</span
            >
            @if (errorCampo('nit'); as mensaje) {
              <p id="tenant-nit-error" class="error-campo">{{ mensaje }}</p>
            }
          </div>
        </div>
        @if (error() && creando()) {
          <p class="alerta" role="alert">{{ error() }}</p>
        }
      </app-dialogo-confirmacion>
    </div>
  `,
})
export class Tenants implements OnInit {
  private readonly api = inject(TenantsApi);

  protected readonly tenants = signal<Tenant[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly pendiente = signal<CambioPendiente | null>(null);
  protected readonly creando = signal(false);
  protected readonly aviso = signal('');
  protected readonly nombreMax = NOMBRE_MAX;
  protected readonly nitMax = NIT_MAX;
  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, longitud(NOMBRE_MIN, NOMBRE_MAX)]],
    nit: ['', [Validators.required, longitud(NIT_MIN, NIT_MAX), formatoNit]],
  });
  /** Errores que devolvió la API por campo (400 `errors` o 409 `nit-registrado`); se borran al editar el campo. */
  private readonly erroresServidor = signal<Partial<Record<CampoTenant, string>>>({});
  /** Cambia con cada edición o envío para que `errorCampo` y el contador lean el formulario actual. */
  private readonly version = signal(0);
  protected readonly largoNombre = computed(() => {
    this.version();
    return this.formulario.controls.name.value.trim().length;
  });
  private readonly campoNombre = viewChild<ElementRef<HTMLInputElement>>('campoNombre');
  private readonly campoNit = viewChild<ElementRef<HTMLInputElement>>('campoNit');
  protected readonly activos = computed(
    () => this.tenants().filter((t) => t.status === 'activo').length,
  );
  protected readonly inactivos = computed(() => this.tenants().length - this.activos());
  protected readonly filasEsqueleto = [1, 2, 3];
  protected readonly consulta = signal('');
  protected readonly filtrados = computed(() =>
    this.tenants().filter((t) => coincide(this.consulta(), t.name, t.nit)),
  );
  protected readonly tituloDialogo = computed(() => {
    const cambio = this.pendiente();
    if (!cambio) {
      return '';
    }
    return `¿${cambio.nuevo === 'activo' ? 'Activar' : 'Desactivar'} ${cambio.tenant.name}?`;
  });

  constructor() {
    for (const campo of ['name', 'nit'] as const) {
      this.formulario.controls[campo].valueChanges.subscribe(() => {
        this.erroresServidor.update((errores) => ({ ...errores, [campo]: undefined }));
        this.version.update((v) => v + 1);
      });
    }
  }

  async ngOnInit(): Promise<void> {
    try {
      this.tenants.set(await firstValueFrom(this.api.listar()));
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  pedirCambio(tenant: Tenant): void {
    this.error.set(null);
    this.aviso.set('');
    this.pendiente.set({ tenant, nuevo: tenant.status === 'activo' ? 'inactivo' : 'activo' });
  }

  cancelarCambio(): void {
    this.pendiente.set(null);
    this.error.set(null);
  }

  async confirmar(): Promise<void> {
    const cambio = this.pendiente();
    if (!cambio) {
      return;
    }
    this.guardando.set(true);
    try {
      const actualizado = await firstValueFrom(
        this.api.cambiarEstado(cambio.tenant.id, cambio.nuevo),
      );
      this.tenants.update((lista) => lista.map((t) => (t.id === actualizado.id ? actualizado : t)));
      this.pendiente.set(null);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  /** Mensaje del campo: primero el de la API; los de la página, cuando el campo ya se tocó o se intentó enviar. */
  protected errorCampo(campo: CampoTenant): string | null {
    this.version();
    const servidor = this.erroresServidor()[campo];
    if (servidor) {
      return servidor;
    }
    const control = this.formulario.controls[campo];
    if (!control.touched || control.valid) {
      return null;
    }
    if (campo === 'name') {
      return control.hasError('required')
        ? 'Escribe el nombre de la empresa.'
        : `El nombre debe tener entre ${NOMBRE_MIN} y ${NOMBRE_MAX} caracteres.`;
    }
    if (control.hasError('required')) {
      return 'Escribe el NIT.';
    }
    return control.hasError('formato')
      ? 'El NIT lleva solo dígitos y, si quieres, un guion con el dígito de verificación.'
      : `El NIT debe tener entre ${NIT_MIN} y ${NIT_MAX} caracteres.`;
  }

  abrirCreacion(): void {
    this.formulario.reset();
    this.erroresServidor.set({});
    this.error.set(null);
    this.aviso.set('');
    this.version.update((v) => v + 1);
    this.creando.set(true);
  }

  cerrarCreacion(): void {
    this.creando.set(false);
    this.error.set(null);
  }

  /** Enter en un campo envía el formulario, como el botón «Crear tenant» del diálogo. */
  protected enviarConEnter(evento: Event): void {
    evento.preventDefault();
    if (!this.guardando()) {
      void this.crearTenant();
    }
  }

  async crearTenant(): Promise<void> {
    this.formulario.markAllAsTouched();
    this.version.update((v) => v + 1);
    if (this.formulario.invalid) {
      this.enfocarPrimerError();
      return;
    }
    const { name, nit } = this.formulario.getRawValue();
    this.guardando.set(true);
    this.error.set(null);
    try {
      const creado = await firstValueFrom(this.api.crear({ name: name.trim(), nit: nit.trim() }));
      this.tenants.update((lista) => [creado, ...lista]);
      this.creando.set(false);
      this.aviso.set(`Tenant «${creado.name}» creado.`);
    } catch (e) {
      const tipo = tipoDeError(e);
      if (tipo === 'nit-registrado') {
        this.erroresServidor.set({ nit: mensajeDeError(e) });
      } else if (tipo !== 'validacion' || !this.marcarErroresDeCampo(e)) {
        this.error.set(mensajeDeError(e));
      }
      this.enfocarPrimerError();
    } finally {
      this.guardando.set(false);
    }
  }

  /** Toma `errors.name` y `errors.nit` del 400; devuelve si alguno corresponde a un campo del formulario. */
  private marcarErroresDeCampo(error: unknown): boolean {
    const errores = erroresDeCampo(error);
    const campos: Partial<Record<CampoTenant, string>> = {};
    for (const campo of ['name', 'nit'] as const) {
      if (errores[campo]) {
        campos[campo] = errores[campo];
      }
    }
    this.erroresServidor.set(campos);
    return Object.keys(campos).length > 0;
  }

  private enfocarPrimerError(): void {
    const campo = this.errorCampo('name')
      ? this.campoNombre()
      : this.errorCampo('nit')
        ? this.campoNit()
        : null;
    campo?.nativeElement.focus();
  }
}
