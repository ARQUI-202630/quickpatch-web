# QUICKPATCH Admin Web

**Tecnología:** Angular 22.2 + TypeScript 6.0 (Node.js 24.21.0, `.nvmrc`).

**Usuarios:** administradores de plataforma/tenant según los roles definidos por el producto.

La aplicación consume únicamente contratos REST publicados en `contracts/api-gateway/openapi/` (submódulo `quickpatch-api-gateway`).

## Estructura

```text
src/app/
  app.ts, app.html, app.routes.ts, app.config.ts   Shell, rutas y proveedores globales
  core/       Servicios de una sola instancia: autenticación, interceptores (JWT, X-Correlation-Id)
  shared/     Componentes, directivas y pipes reutilizables sin estado de negocio
  features/   Una carpeta por capacidad del panel; ninguna feature importa a otra
scripts/test-ci.mjs   Pruebas sin watch para el CI y el hook pre-push
```

## Capacidades

|Pantalla|Rol|Contrato|Historia|
|---|---|---|---|
|Inicio de sesión (solo administradores; los demás roles usan la app móvil)|`admin_tenant`, `admin_plataforma`|`POST /v1/auth/login`|SCRUM-41|
|Tenants: lista, crear con nombre y NIT, activar y desactivar con confirmación|`admin_plataforma`|`GET /v1/platform/tenants` y `PATCH /v1/platform/tenants/{id}` (identity 1.2.0); `POST /v1/platform/tenants` (identity 1.5.0)|SCRUM-41 / SCRUM-112; SCRUM-24 / SCRUM-61|
|Técnicos y proveedores del tenant: lista por estado de verificación con paginación; aprobar, rechazar, suspender y reactivar con confirmación y motivo|`admin_tenant`|`GET /v1/admin/technicians`, `POST /v1/admin/technicians/{userId}/approve`, `/reject` y `/suspend` (identity 1.3.0); `GET /v1/catalog/categories` para la especialidad|SCRUM-39 / SCRUM-107; SCRUM-40 / SCRUM-110|
|Solicitudes (panel operativo): conteos por estado, activas y cerradas, y creadas hoy; lista paginada filtrable por estado con el nombre del técnico; se actualiza cada minuto|`admin_tenant`|`GET /v1/service-requests` y `GET /v1/admin/service-requests/summary` (service-request 1.4.0); `GET /v1/admin/technicians` para el nombre del técnico; `GET /v1/catalog/categories` para la categoría|SCRUM-38 / SCRUM-104|
|Solicitudes por tenant: solo conteos por estado, filtrables por tenant; los tenants sin solicitudes salen en 0|`admin_plataforma`|`GET /v1/platform/service-requests/summary` (service-request 1.4.0); `GET /v1/platform/tenants` para el nombre|SCRUM-38 / SCRUM-104|
|Inicio del administrador del tenant|`admin_tenant`|—|SCRUM-41|
|Activar la cuenta (pública): el técnico del equipo de un proveedor define su contraseña con el enlace de invitación (`/activar#token=…`); la app móvil es el atajo|Sin sesión|`POST /v1/auth/password/setup` (identity 1.7.0)|SCRUM-463|

- Las rutas se protegen por rol (`core/guards.ts`, SCRUM-25); el backend vuelve a validar el rol en cada endpoint.
- Interceptores (`core/http.ts`): `X-Correlation-Id` y el token en las peticiones a `/api`; un 401 cierra la sesión.
- La sesión vive en `sessionStorage` y se borra al cerrar la pestaña. El tenant sale del token, nunca de la UI.
- La API se llama en `/api` del mismo origen: el panel y la API se publican en el mismo nombre detrás del gateway.

## Sistema de diseño

Los estilos salen de tokens CSS definidos en `src/styles/` (SCRUM-434):

```text
src/styles/_tokens.scss   Primitivos (paleta) y semánticos (intención)
src/styles/_base.scss     Reset, tipografía base, foco, selección y cifras tabulares
src/styles.scss           Fuente, tokens, base y estilos globales de formularios, botones y tablas
```

- **Usa solo tokens semánticos** (`--qp-color-*`, `--qp-texto-*`, `--qp-espacio-*`, `--qp-radio-*`, `--qp-sombra-*`) en pantallas y componentes. Los primitivos (`--qp-azul-*`, `--qp-neutro-*`) solo se referencian dentro de `_tokens.scss`. No escribas colores en hexadecimal ni tamaños sueltos.
- **Color:** el azul QUICKPATCH es `#00468c` (`--qp-azul-700`, `--qp-color-primario`). Las escalas están en OKLCH con el mismo tono; los neutros llevan un leve matiz azul.
- **Contraste (WCAG AA):** `--qp-texto` 17.3:1, `--qp-texto-secundario` 6.5:1 y `--qp-texto-marca` 9.2:1 sobre `--qp-superficie`. Los estados (`--qp-exito`, `--qp-aviso`, `--qp-peligro`) superan 4.5:1 sobre su fondo `-fondo`. El borde de los campos (`--qp-borde-fuerte`) y el anillo de foco superan 3:1. `--qp-texto-deshabilitado` es solo para controles deshabilitados. `src/styles/contraste.spec.ts` calcula estos contrastes desde `_tokens.scss`, así que un cambio de paleta que los baje rompe el CI.
- **Tipografía:** Plus Jakarta Sans Variable (`@fontsource-variable/plus-jakarta-sans`, OFL-1.1), autoalojada en el bundle, sin CDN. Escala: `xs` 12, `sm` 14 (tablas, etiquetas y botones), `md` 16 (cuerpo), `lg` 18, `xl` 22 (título de página) y `2xl` 28 px. Las tablas usan cifras tabulares.
- **Espaciado:** escala de 4 px (`--qp-espacio-1` = 4 px … `--qp-espacio-12` = 48 px). Los controles miden al menos `--qp-alto-control` (40 px).
- **Movimiento:** `--qp-curva-salida` con `--qp-duracion-rapida` (120 ms) para hover y presión, y `--qp-duracion-media` (200 ms) para menús y diálogos. Con `prefers-reduced-motion` las duraciones son 0.
- **Shell (SCRUM-435):** con sesión, barra lateral azul (`--qp-lateral-*`) con la navegación por rol y encabezado con el usuario; por debajo de 56rem la barra es un panel deslizable (botón de menú, velo y Escape). Iconos en `shared/icono.ts` (SVG propio, trazo 1.75 px). Las rutas definen el título del documento.
- **Componentes compartidos (`src/app/shared/`, SCRUM-437):**
  - `app-insignia` (`tono`: `exito`, `aviso`, `peligro`, `info`, `neutro`): estado con texto; el color nunca va solo.
  - `app-estado-verificacion` (`estado`): `verificationStatus` del técnico (pendiente, aprobado, rechazado, suspendido).
  - `app-campo-busqueda` (`etiqueta`, `[(valor)]`) y `coincide()`: filtran listas ya cargadas sin distinguir tildes ni mayúsculas; no llaman a la API.
  - `app-dialogo-confirmacion` (`abierto`, `titulo`, `textoConfirmar`, `peligro`, `ocupado`, `(confirmar)`, `(cancelar)`): `<dialog>` modal nativo para acciones con consecuencias; el contenido proyectado explica qué pasa.
  - `app-tarjeta-detalle` (`titulo`, `subtitulo`, `datos`, ranuras `[estado]` y `[acciones]`): detalle de una entidad, como el técnico en SCRUM-39.
  - Patrones de página en `styles.scss`: `.pagina`, `.encabezado-pagina`, `.alerta`, `.vacio`, `.esqueleto` y `button.peligro`.
- **Estados de componentes:** todo control interactivo define hover, foco visible (`--qp-foco`), deshabilitado y, si aplica, cargando, vacío y error.

## Accesibilidad

Objetivo: WCAG 2.2 AA (SCRUM-438).

- **Teclado y foco:** «Saltar al contenido» es el primer enlace. Al cambiar de ruta el foco pasa al contenido (`#contenido`). El panel deslizable lleva el foco a «Cerrar menú», deja inerte el resto de la página y al cerrarse (botón, velo o Escape) devuelve el foco a «Abrir menú». El diálogo de confirmación abre con el foco en «Cancelar» y se cierra con Escape.
- **Formularios:** cada campo tiene etiqueta; los errores se enlazan con `aria-describedby` y marcan `aria-invalid`. Los errores del servidor usan `role="alert"` y las cargas `role="status"`.
- **Pruebas automáticas:** `src/app/accesibilidad.spec.ts` pasa axe-core (reglas WCAG 2.x A y AA) por cada pantalla y estado: inicio de sesión con errores, inicio, tenants cargando, con datos, vacío y sin resultados, diálogo con error, solicitudes del tenant con datos y filtro, conteos por tenant y shell con el menú abierto. El contraste lo cubre `contraste.spec.ts`, porque jsdom no calcula estilos.
- **Pendiente manual:** revisar con lector de pantalla (NVDA o VoiceOver) y zoom al 200 % antes de cada entrega.

## Comandos

```bash
npm ci
npm start                          # servidor de desarrollo
npm run lint                       # ESLint (angular-eslint)
npm test                           # Vitest en modo watch
npm run test:ci -- --code-coverage # como el CI: sin watch y con cobertura (≥ 80%)
npm run build                      # build de producción en dist/
```
