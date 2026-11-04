import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/*
 * Contraste WCAG 2.2 de los tokens (SCRUM-438). Lee _tokens.scss, resuelve las variables y convierte OKLCH a sRGB
 * para que un cambio de paleta que baje el contraste rompa el CI. Mínimos: 4.5:1 para texto (1.4.3) y 3:1 para
 * bordes de campos y anillo de foco (1.4.11).
 */
const fuente = readFileSync(resolve(process.cwd(), 'src/styles/_tokens.scss'), 'utf8').split(
  '@media',
)[0];
const tokens = new Map(
  [...fuente.matchAll(/--(qp-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
);

function valor(token: string): string {
  let actual = tokens.get(token);
  for (let saltos = 0; actual?.startsWith('var(') && saltos < 10; saltos++) {
    actual = tokens.get(actual.slice('var(--'.length, -1));
  }
  if (!actual?.startsWith('oklch(')) {
    throw new Error(`--${token} no resuelve a un color oklch(): ${actual}`);
  }
  return actual;
}

/** Luminancia relativa (WCAG) de un color oklch(L C H). */
function luminancia(oklch: string): number {
  const [l, c, h] = oklch.slice('oklch('.length, -1).trim().split(/\s+/).map(Number);
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const lms = [
    l + 0.3963377774 * a + 0.2158037573 * b,
    l - 0.1055613458 * a - 0.0638541728 * b,
    l - 0.0894841775 * a - 1.291485548 * b,
  ].map((x) => x ** 3);
  const lineal = [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ].map((x) => Math.min(1, Math.max(0, x)));
  return 0.2126 * lineal[0] + 0.7152 * lineal[1] + 0.0722 * lineal[2];
}

function contraste(primero: string, segundo: string): number {
  const [claro, oscuro] = [luminancia(valor(primero)), luminancia(valor(segundo))].sort(
    (x, y) => y - x,
  );
  return (claro + 0.05) / (oscuro + 0.05);
}

describe('contraste de los tokens', () => {
  it('el azul de marca sigue siendo #00468c', () => {
    // sRGB lineal de #00468c: (0, 0.0612, 0.2623).
    expect(luminancia(valor('qp-azul-700'))).toBeCloseTo(0.0612 * 0.7152 + 0.2623 * 0.0722, 2);
  });

  it.each([
    // Texto general
    ['qp-texto', 'qp-superficie'],
    ['qp-texto', 'qp-fondo'],
    ['qp-texto-secundario', 'qp-superficie'],
    ['qp-texto-secundario', 'qp-fondo'],
    ['qp-texto-secundario', 'qp-superficie-sutil'],
    ['qp-texto-secundario', 'qp-superficie-hover'],
    ['qp-texto-secundario', 'qp-neutro-100'], // insignia neutra
    ['qp-texto-marca', 'qp-superficie'],
    ['qp-texto-marca', 'qp-color-secundario'],
    ['qp-texto-marca', 'qp-color-secundario-hover'],
    ['qp-azul-800', 'qp-color-secundario'], // avatar
    // Botones
    ['qp-texto-sobre-primario', 'qp-color-primario'],
    ['qp-texto-sobre-primario', 'qp-color-primario-hover'],
    ['qp-texto-sobre-primario', 'qp-color-primario-activo'],
    ['qp-texto-sobre-primario', 'qp-peligro'],
    // Barra lateral e inicio de sesión
    ['qp-lateral-texto', 'qp-lateral-fondo'],
    ['qp-lateral-texto-secundario', 'qp-lateral-fondo'],
    ['qp-lateral-texto', 'qp-lateral-hover'],
    ['qp-lateral-texto', 'qp-lateral-activo'],
    // Estados (insignias y alertas)
    ['qp-exito', 'qp-exito-fondo'],
    ['qp-aviso', 'qp-aviso-fondo'],
    ['qp-peligro', 'qp-peligro-fondo'],
    ['qp-info', 'qp-info-fondo'],
    ['qp-peligro', 'qp-superficie'],
  ])('texto --%s sobre --%s llega a 4.5:1', (texto, fondo) => {
    expect(contraste(texto, fondo)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['qp-borde-fuerte', 'qp-superficie'],
    ['qp-borde-fuerte-hover', 'qp-superficie'],
    ['qp-foco', 'qp-superficie'],
    ['qp-foco', 'qp-fondo'],
    ['qp-peligro', 'qp-superficie'], // borde de campo inválido
  ])('el borde --%s sobre --%s llega a 3:1', (borde, fondo) => {
    expect(contraste(borde, fondo)).toBeGreaterThanOrEqual(3);
  });

  it('falla con un token que no existe', () => {
    expect(() => contraste('qp-no-existe', 'qp-superficie')).toThrow(/no resuelve/);
  });
});
