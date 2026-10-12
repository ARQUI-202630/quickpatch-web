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
|Tenants: lista, activar y desactivar con confirmación|`admin_plataforma`|`GET /v1/platform/tenants`, `PATCH /v1/platform/tenants/{id}` (identity 1.2.0)|SCRUM-41 / SCRUM-112|
|Inicio del administrador del tenant|`admin_tenant`|—|SCRUM-41|

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
- **Contraste (WCAG AA):** `--qp-texto` 17.3:1, `--qp-texto-secundario` 6.5:1 y `--qp-texto-marca` 9.2:1 sobre `--qp-superficie`. Los estados (`--qp-exito`, `--qp-aviso`, `--qp-peligro`) superan 4.5:1 sobre su fondo `-fondo`. `--qp-texto-deshabilitado` es solo para controles deshabilitados.
- **Tipografía:** Plus Jakarta Sans Variable (`@fontsource-variable/plus-jakarta-sans`, OFL-1.1), autoalojada en el bundle, sin CDN. Escala: `xs` 12, `sm` 14 (tablas, etiquetas y botones), `md` 16 (cuerpo), `lg` 18, `xl` 22 (título de página) y `2xl` 28 px. Las tablas usan cifras tabulares.
- **Espaciado:** escala de 4 px (`--qp-espacio-1` = 4 px … `--qp-espacio-12` = 48 px). Los controles miden al menos `--qp-alto-control` (40 px).
- **Movimiento:** `--qp-curva-salida` con `--qp-duracion-rapida` (120 ms) para hover y presión, y `--qp-duracion-media` (200 ms) para menús y diálogos. Con `prefers-reduced-motion` las duraciones son 0.
- **Estados de componentes:** todo control interactivo define hover, foco visible (`--qp-foco`), deshabilitado y, si aplica, cargando, vacío y error.

## Comandos

```bash
npm ci
npm start                          # servidor de desarrollo
npm run lint                       # ESLint (angular-eslint)
npm test                           # Vitest en modo watch
npm run test:ci -- --code-coverage # como el CI: sin watch y con cobertura (≥ 80%)
npm run build                      # build de producción en dist/
```
