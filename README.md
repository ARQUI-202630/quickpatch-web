# QUICKPATCH Admin Web

**Tecnología:** Angular 22.2 + TypeScript 6.0 (Node.js 24.21.0, `.nvmrc`).

**Usuarios:** administradores de plataforma/tenant según los roles definidos por el producto.

La aplicación consume únicamente contratos REST publicados en `contracts/openapi/` (submódulo `quickpatch-contracts`).

## Estructura

```text
src/app/
  app.ts, app.html, app.routes.ts, app.config.ts   Shell, rutas y proveedores globales
  core/       Servicios de una sola instancia: autenticación, interceptores (JWT, X-Correlation-Id)
  shared/     Componentes, directivas y pipes reutilizables sin estado de negocio
  features/   Una carpeta por capacidad del panel; ninguna feature importa a otra
scripts/test-ci.mjs   Pruebas sin watch para el CI y el hook pre-push
```

## Comandos

```bash
npm ci
npm start                          # servidor de desarrollo
npm run lint                       # ESLint (angular-eslint)
npm test                           # Vitest en modo watch
npm run test:ci -- --code-coverage # como el CI: sin watch y con cobertura (≥ 80%)
npm run build                      # build de producción en dist/
```
