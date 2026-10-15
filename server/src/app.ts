// Express routes: health, the film list and the film files (PROJECT.md section 7.3).
import express, { type Express } from 'express';
import { fileURLToPath } from 'node:url';
import type { Config } from './config.js';
import { toContentView, type Content } from './film/content.js';

const SERVER_VERSION = '0.1.0';
export const MEDIA_DIR = fileURLToPath(new URL('../media', import.meta.url));

/** Builds the HTTP app. The media folder can be swapped for tests. */
export function createApp(
  config: Config,
  films: Content[],
  options: { mediaDir?: string } = {},
): Express {
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

  // express.static answers Range requests with 206, which the TV's player needs to seek.
  app.use('/media', express.static(options.mediaDir ?? MEDIA_DIR, { fallthrough: true }));
  // A missing film file must answer 404, never fall through to the pad's page (added in Step 5).
  app.use('/media', (_req, res) => {
    res.status(404).json({ ok: false, error: 'not-found' });
  });

  return app;
}
