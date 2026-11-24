/**
 * Enlaces con token en el fragmento, comunes a la activación de la cuenta (SCRUM-463) y a la recuperación de la
 * contraseña (SCRUM-624). El fragmento no viaja al servidor ni queda en los registros del Gateway.
 */

/**
 * Token de la invitación en el fragmento del enlace (`#token=…`, identity 1.7.0): 43 caracteres base64url
 * (256 bits). Devuelve `null` si falta o no tiene esa forma.
 */
export function tokenDeFragmento(fragmento: string | null): string | null {
  const token = new URLSearchParams(fragmento ?? '').get('token');
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
