// scripts/tunnel.mjs
// Starts a Cloudflare quick tunnel to the local server and writes its HTTPS URL into
// server/.env (PUBLIC_URL) and tv/src/config.ts (SERVER_URL). Start it before the server.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT ?? '8787';
const urlPattern = /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/;
const tvPattern = /export const SERVER_URL = ['"][^'"]*['"];/;
let found = false;
let buffer = '';

function setEnvLine(file, key, value) {
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  writeFileSync(file, `${lines.join('\n')}\n`);
}

function setTvUrl(file, url) {
  if (!existsSync(file)) return 'skipped (tv/src/config.ts not found)';
  const text = readFileSync(file, 'utf8');
  if (!tvPattern.test(text)) return 'skipped (SERVER_URL line not found)';
  writeFileSync(file, text.replace(tvPattern, `export const SERVER_URL = '${url}';`));
  return 'updated';
}

function onOutput(chunk) {
  const text = chunk.toString();
  process.stdout.write(text);
  if (found) return;
  buffer = (buffer + text).slice(-4000); // the URL can arrive split across two chunks
  const match = buffer.match(urlPattern);
  if (!match) return;
  found = true;
  const url = match[0];
  setEnvLine(join(root, 'server', '.env'), 'PUBLIC_URL', url);
  const tv = setTvUrl(join(root, 'tv', 'src', 'config.ts'), url);
  console.log(`\nTunnel ready: ${url}\n  server/.env PUBLIC_URL updated\n  tv/src/config.ts ${tv}\nNow start (or restart) the server.\n`);
}

const child = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', onOutput);
child.stderr.on('data', onOutput);
child.on('error', (error) => {
  console.error(`Could not start cloudflared (${error.message}). Install it with: brew install cloudflared`);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
