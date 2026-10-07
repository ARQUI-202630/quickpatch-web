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

## Comandos

```bash
npm ci
npm start                          # servidor de desarrollo
npm run lint                       # ESLint (angular-eslint)
npm test                           # Vitest en modo watch
npm run test:ci -- --code-coverage # como el CI: sin watch y con cobertura (≥ 80%)
npm run build                      # build de producción en dist/
```
