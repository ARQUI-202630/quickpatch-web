# features

Una carpeta por capacidad del panel (por ejemplo `tenants/`, `technicians/`), con sus rutas, componentes y el cliente HTTP generado a partir de `contracts/api-gateway/openapi/`. Ninguna feature importa a otra, y `core/` y `shared/` no importan de `features/`: lo verifica ESLint (`no-restricted-imports` en `eslint.config.js`, SCRUM-713). Lo que usan varias features va en `core/` (sin pantallas) o en `shared/` (componentes).
