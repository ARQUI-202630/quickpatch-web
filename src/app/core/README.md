# core

Servicios de una sola instancia: autenticación, interceptores HTTP (JWT y `X-Correlation-Id`) y configuración. Se importa solo desde `app.config.ts`.

`enlaces.ts` lee el token del fragmento de los enlaces de activación y de recuperación de la contraseña, que usan dos features.
