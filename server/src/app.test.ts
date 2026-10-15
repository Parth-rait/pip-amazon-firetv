import { mkdtempSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { parseConfig } from './config.js';
import { loadFilms } from './film/content.js';

const config = parseConfig({ PUBLIC_URL: 'https://pip.example.com' });
const films = loadFilms(new URL('../content/', import.meta.url).pathname);
const mediaDir = mkdtempSync(join(tmpdir(), 'pip-media-'));
writeFileSync(join(mediaDir, 'big-buck-bunny.mp4'), Buffer.alloc(1000, 1));
const padDir = mkdtempSync(join(tmpdir(), 'pip-pad-'));
writeFileSync(join(padDir, 'index.html'), '<!doctype html><title>Pip Pad</title>');

let baseUrl = '';
let close: () => void = () => {};

beforeAll(async () => {
  const server = createApp(config, films, {
    mediaDir,
    padDir,
    hasSession: (code) => code === 'ABCD',
  }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});

afterAll(() => close());

describe('createApp', () => {
  it('answers /health', async () => {
    const body = await (await fetch(`${baseUrl}/health`)).json();
    expect(body).toMatchObject({ ok: true, version: '0.1.0', ai: true });
  });

  it('lists the films with full URLs and no notes or quiz', async () => {
    const body = (await (await fetch(`${baseUrl}/api/films`)).json()) as unknown[];
    expect(body).toEqual([
      expect.objectContaining({
        id: 'big-buck-bunny',
        url: 'https://pip.example.com/media/big-buck-bunny.mp4',
      }),
    ]);
    expect(body[0]).not.toHaveProperty('notes');
  });

  it('answers a Range request with 206 and video/mp4', async () => {
    const res = await fetch(`${baseUrl}/media/big-buck-bunny.mp4`, {
      headers: { Range: 'bytes=0-99' },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect((await res.arrayBuffer()).byteLength).toBe(100);
  });

  it('draws a PNG QR code for a live session and 404s an unknown code', async () => {
    const res = await fetch(`${baseUrl}/qr/ABCD`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect((await fetch(`${baseUrl}/qr/WXYZ`)).status).toBe(404);
    expect((await fetch(`${baseUrl}/qr/nope`)).status).toBe(404);
  });

  it('serves the pad for any other GET, but never for /api, /qr or /media', async () => {
    const page = await fetch(`${baseUrl}/watch?code=ABCD`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('Pip Pad');
    expect((await fetch(`${baseUrl}/api/missing`)).status).toBe(404);
    expect((await fetch(`${baseUrl}/media/missing.mp4`)).headers.get('content-type')).toContain(
      'json',
    );
  });

  it('answers 404 for a missing film file', async () => {
    expect((await fetch(`${baseUrl}/media/missing.mp4`)).status).toBe(404);
  });
});
