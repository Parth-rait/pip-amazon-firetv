// Express routes: health, the film list, QR codes, the film files and the built pad (section 7.3).
import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import type { Config } from './config.js';
import { isValidCode } from './core/codes.js';
import { toContentView, watchedScenes, type Content } from './film/content.js';
import { errorFields, log } from './log.js';

const SERVER_VERSION = '0.1.0';
const QR_OPTIONS = { type: 'png', width: 512, margin: 2 } as const;
export const MEDIA_DIR = fileURLToPath(new URL('../media', import.meta.url));
export const PAD_DIR = fileURLToPath(new URL('../../pad/dist', import.meta.url));
const NOT_PAD_PATHS = /^\/(api|qr|media|socket\.io)(\/|$)/;

export interface AppOptions {
  hasSession?: (code: string) => boolean; // a QR code is drawn only for a live session
  mediaDir?: string; // swapped in tests
  padDir?: string; // the built pad; served only when the folder exists
}

/** Builds the HTTP app. */
export function createApp(config: Config, films: Content[], options: AppOptions = {}): Express {
  const hasSession = options.hasSession ?? (() => false);
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      version: SERVER_VERSION,
      uptimeSec: Math.floor(process.uptime()),
      ai: config.AI_ENABLED,
    });
  });

  app.get('/api/films', (_req, res) => {
    res.json(films.map((film) => toContentView(film, config.PUBLIC_URL)));
  });

  // Scenes the family has watched: the TV asks with its resume position, never for more.
  app.get('/api/films/:id/scenes', (req, res) => {
    const film = films.find((f) => f.id === req.params.id);
    const until = Number(req.query.until);
    if (!film || !Number.isFinite(until) || until < 0) {
      res.status(404).json({ ok: false, error: 'not-found' });
      return;
    }
    res.json(watchedScenes(film, until, config.PUBLIC_URL));
  });

  app.get('/qr/:code', async (req, res) => {
    const { code } = req.params;
    if (!isValidCode(code) || !hasSession(code)) {
      res.status(404).json({ ok: false, error: 'unknown-code' });
      return;
    }
    try {
      const png = await QRCode.toBuffer(`${config.PUBLIC_URL}/?code=${code}`, QR_OPTIONS);
      res.type('image/png').send(png);
    } catch (error) {
      log.error('qr.failed', { code, ...errorFields(error) });
      res.status(500).json({ ok: false, error: 'qr-failed' });
    }
  });

  // express.static answers Range requests with 206, which the TV's player needs to seek.
  app.use('/media', express.static(options.mediaDir ?? MEDIA_DIR, { fallthrough: true }));
  // A missing film file must answer 404, never fall through to the pad's page (added in Step 5).
  app.use('/media', (_req, res) => {
    res.status(404).json({ ok: false, error: 'not-found' });
  });

  servePad(app, options.padDir ?? PAD_DIR);
  return app;
}

/**
 * The built pad, with index.html for any other GET, so links like /?code=K7QD open the app; and
 * the browser TV (tv.html, a second TV client on the same protocol) at /tv.
 */
function servePad(app: Express, padDir: string): void {
  if (!existsSync(join(padDir, 'index.html'))) return;
  if (existsSync(join(padDir, 'tv.html'))) {
    app.get('/tv', (_req, res) => res.sendFile(join(padDir, 'tv.html')));
  }
  app.use(express.static(padDir));
  // Express 5 no longer accepts '*' as a path, so the fallback is the last middleware.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || NOT_PAD_PATHS.test(req.path)) return next();
    res.sendFile(join(padDir, 'index.html'));
  });
}
