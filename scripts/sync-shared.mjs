// scripts/sync-shared.mjs
// Copies shared/protocol.ts into each package that exists. With --check, exits 1 if a copy is stale.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const header = '// GENERATED from shared/protocol.ts by scripts/sync-shared.mjs. Do not edit this copy.\n';
const expected = header + readFileSync(join(root, 'shared', 'protocol.ts'), 'utf8');
const targets = ['server/src/shared', 'pad/src/shared', 'tv/src/shared'];
const check = process.argv.includes('--check');
let stale = 0;

for (const dir of targets) {
  const pkg = dir.split('/')[0];
  if (!existsSync(join(root, pkg))) {
    console.log(`skip  ${pkg}/ (not created yet)`);
    continue;
  }
  const file = join(root, dir, 'protocol.ts');
  const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (current === expected) {
    console.log(`ok    ${dir}/protocol.ts`);
  } else if (check) {
    console.error(`STALE ${dir}/protocol.ts (run npm run sync:shared)`);
    stale += 1;
  } else {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(file, expected);
    console.log(`wrote ${dir}/protocol.ts`);
  }
}

process.exit(stale > 0 ? 1 : 0);
