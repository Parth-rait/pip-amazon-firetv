// scripts/run-all.mjs
// Runs one npm script (typecheck, lint or test) in each package that exists. Usage: node scripts/run-all.mjs test
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = process.argv[2];
const packages = ['server', 'pad', 'tv'];
let failed = 0;

if (!script) {
  console.error('Usage: node scripts/run-all.mjs <script>');
  process.exit(2);
}

for (const pkg of packages) {
  if (!existsSync(join(root, pkg, 'package.json'))) {
    console.log(`skip  ${pkg}/ (not created yet)`);
    continue;
  }
  console.log(`\n> ${pkg}: npm run ${script}`);
  const result = spawnSync('npm', ['run', script], { cwd: join(root, pkg), stdio: 'inherit' });
  if (result.status !== 0) failed += 1;
}

process.exit(failed > 0 ? 1 : 0);
