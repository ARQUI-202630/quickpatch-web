// Pruebas sin modo watch para el CI y el hook pre-push.
// ci-angular.yml llama `npm run test:ci -- --code-coverage` (flag heredado de Karma). Con Vitest,
// `ng test` no lo acepta, así que aquí se traduce a --coverage con el reporte text-summary,
// que imprime la línea "Lines : NN%" que lee la acción de cobertura.
import { spawnSync } from 'node:child_process';

const conCobertura = process.argv.slice(2).includes('--code-coverage');
const args = ['test', '--watch=false'];
if (conCobertura) {
  args.push('--coverage', '--coverage-reporters=text-summary', '--coverage-reporters=lcov');
}

const resultado = spawnSync('ng', args, { stdio: 'inherit', shell: true });
process.exit(resultado.status ?? 1);
