import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icono, NombreIcono } from '../../shared/icono';

/** Último APK publicado de la app móvil (release de GitHub del repositorio público quickpatch-mobile). */
export const DESCARGA_APP = 'https://github.com/ARQUI-202630/quickpatch-mobile/releases/latest';

interface Elemento {
  icono: NombreIcono;
  titulo: string;
  texto: string;
}

/** Ciclo del servicio del SRS (sección 3): solicita → cotiza → acepta → ejecuta → paga → califica. */
const PASOS: readonly Elemento[] = [
  {
    icono: 'solicitudes',
    titulo: 'Pide el servicio',
    texto: 'Describe qué necesitas, elige la categoría y escribe tu dirección en Bogotá.',
  },
  {
    icono: 'ubicacion',
    titulo: 'Te asignamos un técnico',
    texto:
      'QUICKPATCH busca un técnico disponible que cubra tu localidad y le envía la oferta. Si no la acepta en 3 minutos, pasa al siguiente.',
  },
  {
    icono: 'tarjeta',
    titulo: 'Conoce el precio antes',
    texto:
      'El técnico te envía la cotización y tú decides si la aceptas. Nada empieza sin tu visto bueno.',
  },
  {
    icono: 'camara',
    titulo: 'Sigue el trabajo en vivo',
    texto:
      'Ves el estado en tiempo real y las fotos del trabajo que el técnico sube como evidencia.',
  },
  {
    icono: 'candado',
    titulo: 'Paga seguro',
    texto: 'El pago va por una pasarela certificada PCI-DSS y recibes tu comprobante.',
  },
  {
    icono: 'estrella',
    titulo: 'Califica',
    texto: 'Tu calificación construye la reputación de cada técnico.',
  },
];

/** Usuarios de la app móvil (SRS, sección 3). */
const PERFILES: readonly Elemento[] = [
  {
    icono: 'inicio',
    titulo: 'Clientes',
    texto:
      'Un servicio rápido y confiable para tu hogar, con el precio claro y seguimiento en tiempo real.',
  },
  {
    icono: 'tenants',
    titulo: 'Empresas',
    texto: 'Solicitudes y pagos de varias sedes bajo una sola cuenta, con usuarios autorizados.',
  },
  {
    icono: 'herramienta',
    titulo: 'Técnicos',
    texto:
      'Ofertas de tu especialidad y tu zona. Tú decides cuándo estás disponible y rechazar no tiene penalización.',
  },
  {
    icono: 'tecnicos',
    titulo: 'Proveedores',
    texto: 'Administra tu equipo de técnicos e invítalos a la plataforma con un enlace.',
  },
];

/** Garantías que respaldan los requisitos y decisiones de arquitectura (SRS 2.3, SAD). */
const GARANTIAS: readonly Elemento[] = [
  {
    icono: 'escudo',
    titulo: 'Técnicos verificados',
    texto:
      'El administrador de cada empresa revisa los documentos del técnico antes de que reciba solicitudes.',
  },
  {
    icono: 'candado',
    titulo: 'Tu tarjeta no se guarda',
    texto:
      'Los pagos se procesan con una pasarela certificada PCI-DSS. QUICKPATCH no almacena los datos de tu tarjeta.',
  },
  {
    icono: 'usuario',
    titulo: 'Datos protegidos',
    texto:
      'Cada empresa opera con sus datos aislados de las demás, conforme a la Ley 1581 de 2012.',
  },
  {
    icono: 'camara',
    titulo: 'Evidencia de cada servicio',
    texto: 'Las fotos del trabajo y el historial de cada solicitud quedan registrados.',
  },
];

/** Estados que la app muestra al cliente (contrato service-request). */
const ESTADOS: readonly { etiqueta: string; paso: 'hecho' | 'actual' | 'pendiente' }[] = [
  { etiqueta: 'Solicitud creada', paso: 'hecho' },
  { etiqueta: 'Técnico asignado', paso: 'hecho' },
  { etiqueta: 'Cotización aceptada', paso: 'hecho' },
  { etiqueta: 'En progreso', paso: 'actual' },
  { etiqueta: 'Completado', paso: 'pendiente' },
];

/**
 * Página de presentación pública de QUICKPATCH (SCRUM-491, pedida por el profesor el 20 de octubre de 2026). Cuenta
 * qué es la plataforma, cómo funciona y para quién es, y lleva a la descarga de la app o al panel. Es una sola
 * página: el SEO y las redes sociales siguen fuera del alcance del MVP (SAD, FA2).
 */
@Component({
  selector: 'app-presentacion',
  imports: [RouterLink, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './presentacion.scss',
  template: `
    <header class="barra">
      <div class="contenedor barra-contenido">
        <a class="marca" routerLink="/" aria-label="QUICKPATCH, inicio">
          <span class="sello" aria-hidden="true">Q</span>
          <span class="nombre" aria-hidden="true">QUICKPATCH</span>
        </a>
        <nav aria-label="Secciones">
          <ul>
            <li><a href="#como-funciona">Cómo funciona</a></li>
            <li><a href="#para-quien">Para quién</a></li>
            <li><a href="#confianza">Confianza</a></li>
          </ul>
        </nav>
        <a class="boton secundario" routerLink="/iniciar-sesion">Iniciar sesión</a>
      </div>
    </header>

    <section class="portada" aria-labelledby="titulo-portada">
      <div class="contenedor portada-contenido">
        <div class="portada-texto">
          <p class="etiqueta">
            <app-icono nombre="ubicacion" [tamano]="16" />
            Bogotá D.C.
          </p>
          <h1 id="titulo-portada">
            El técnico que necesitas, con el precio claro desde el principio.
          </h1>
          <p class="bajada">
            QUICKPATCH conecta a hogares y empresas con técnicos verificados. Pides el servicio
            desde la app, recibes la cotización antes de aceptar y sigues el trabajo en tiempo real
            hasta el pago.
          </p>
          <div class="acciones">
            <a class="boton" [href]="descarga" target="_blank" rel="noopener">
              <app-icono nombre="descargar" [tamano]="18" />
              Descargar la app para Android
              <span class="visualmente-oculto">(se abre en una pestaña nueva)</span>
            </a>
            <a class="boton fantasma" href="#como-funciona">
              Cómo funciona
              <app-icono nombre="flecha" [tamano]="18" />
            </a>
          </div>
        </div>

        <figure class="maqueta" aria-labelledby="pie-maqueta">
          <div class="telefono" aria-hidden="true">
            <div class="pantalla">
              <p class="maqueta-titulo">Plomería</p>
              <p class="maqueta-direccion">
                <app-icono nombre="ubicacion" [tamano]="14" />
                Chapinero
              </p>
              <ol class="linea-tiempo">
                @for (estado of estados; track estado.etiqueta) {
                  <li [class]="estado.paso">
                    <span class="punto"></span>
                    {{ estado.etiqueta }}
                  </li>
                }
              </ol>
              <div class="maqueta-tarjeta">
                <app-icono nombre="camara" [tamano]="16" />
                3 fotos del trabajo
              </div>
            </div>
          </div>
          <figcaption id="pie-maqueta" class="visualmente-oculto">
            Ejemplo de una solicitud en la app: el técnico ya inició el trabajo y subió 3 fotos de
            evidencia.
          </figcaption>
        </figure>
      </div>
    </section>

    <section class="cifras" aria-label="QUICKPATCH en cifras">
      <ul class="contenedor">
        <li><strong>20</strong> localidades de Bogotá cubiertas</li>
        <li><strong>3 min</strong> para que el técnico responda la oferta</li>
        <li><strong>10</strong> fotos de evidencia por servicio</li>
        <li><strong>PCI-DSS</strong> en cada pago con tarjeta</li>
      </ul>
    </section>

    <section id="como-funciona" class="seccion" aria-labelledby="titulo-como">
      <div class="contenedor">
        <p class="antetitulo">Cómo funciona</p>
        <h2 id="titulo-como">De la solicitud a la calificación, en seis pasos</h2>
        <ol class="pasos">
          @for (paso of pasos; track paso.titulo; let i = $index) {
            <li class="paso">
              <span class="numero" aria-hidden="true">{{ i + 1 }}</span>
              <app-icono [nombre]="paso.icono" [tamano]="22" />
              <h3>{{ paso.titulo }}</h3>
              <p>{{ paso.texto }}</p>
            </li>
          }
        </ol>
      </div>
    </section>

    <section id="para-quien" class="seccion sutil" aria-labelledby="titulo-quien">
      <div class="contenedor">
        <p class="antetitulo">Para quién</p>
        <h2 id="titulo-quien">Una app para todos los que hacen parte del servicio</h2>
        <ul class="rejilla">
          @for (perfil of perfiles; track perfil.titulo) {
            <li class="tarjeta-info">
              <span class="icono-fondo"><app-icono [nombre]="perfil.icono" /></span>
              <h3>{{ perfil.titulo }}</h3>
              <p>{{ perfil.texto }}</p>
            </li>
          }
        </ul>
        <aside class="empresas" aria-labelledby="titulo-empresas">
          <div>
            <h3 id="titulo-empresas">¿Tu empresa ofrece servicios técnicos?</h3>
            <p>
              Opera en QUICKPATCH con tus propios técnicos, tu catálogo y tus datos aislados de las
              demás empresas. Tus administradores verifican técnicos y siguen las solicitudes desde
              el panel web.
            </p>
          </div>
          <a class="boton" routerLink="/iniciar-sesion">Ir al panel</a>
        </aside>
      </div>
    </section>

    <section id="confianza" class="seccion" aria-labelledby="titulo-confianza">
      <div class="contenedor">
        <p class="antetitulo">Confianza</p>
        <h2 id="titulo-confianza">Seguridad en cada paso</h2>
        <ul class="rejilla">
          @for (garantia of garantias; track garantia.titulo) {
            <li class="tarjeta-info">
              <span class="icono-fondo"><app-icono [nombre]="garantia.icono" /></span>
              <h3>{{ garantia.titulo }}</h3>
              <p>{{ garantia.texto }}</p>
            </li>
          }
        </ul>
      </div>
    </section>

    <section class="cierre" aria-labelledby="titulo-cierre">
      <div class="contenedor cierre-contenido">
        <h2 id="titulo-cierre">Lleva QUICKPATCH en tu celular</h2>
        <p>Clientes, empresas, técnicos y proveedores usan la misma app.</p>
        <a class="boton claro" [href]="descarga" target="_blank" rel="noopener">
          <app-icono nombre="descargar" [tamano]="18" />
          Descargar la app para Android
          <span class="visualmente-oculto">(se abre en una pestaña nueva)</span>
        </a>
      </div>
    </section>

    <footer class="pie">
      <div class="contenedor pie-contenido">
        <p>
          <strong>QUICKPATCH</strong> · Servicios técnicos para el hogar y las empresas en Bogotá
          D.C.
        </p>
        <p>Proyecto del curso Arquitectura de Software, 2026.</p>
      </div>
    </footer>
  `,
})
export class Presentacion {
  protected readonly descarga = DESCARGA_APP;
  protected readonly pasos = PASOS;
  protected readonly perfiles = PERFILES;
  protected readonly garantias = GARANTIAS;
  protected readonly estados = ESTADOS;
}
