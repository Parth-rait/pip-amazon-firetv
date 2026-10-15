// Express routes: health, the film list, QR codes and the film files (PROJECT.md section 7.3).
import express, { type Express } from 'express';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import type { Config } from './config.js';
import { isValidCode } from './core/codes.js';
import { toContentView, type Content } from './film/content.js';
import { errorFields, log } from './log.js';

const SERVER_VERSION = '0.1.0';
const QR_OPTIONS = { type: 'png', width: 512, margin: 2 } as const;
export const MEDIA_DIR = fileURLToPath(new URL('../media', import.meta.url));

export interface AppOptions {
  hasSession?: (code: string) => boolean; // a QR code is drawn only for a live session
  mediaDir?: string; // swapped in tests
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

  return app;
}
