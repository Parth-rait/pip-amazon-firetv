// The Pip Core rule (PROJECT.md section 4.3): core/ imports only from core/ and shared/.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CORE_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(CORE_DIR, '..');
const ALLOWED = [CORE_DIR, join(SRC_DIR, 'shared')];

function filesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesIn(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('Pip Core', () => {
  it('never imports from outside src/core and src/shared', () => {
    const offenders: string[] = [];
    for (const file of filesIn(CORE_DIR)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
        const target = resolve(dirname(file), match[1] ?? '');
        if (!ALLOWED.some((dir) => target.startsWith(dir + '/'))) {
          offenders.push(`${relative(SRC_DIR, file)} -> ${match[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
