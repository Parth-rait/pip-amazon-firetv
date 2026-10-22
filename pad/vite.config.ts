// Vite config: React, three pages (the pad at /, the browser TV at /tv, the Command Center at /hub),
// and a dev proxy so all of them on :5173 talk to the server on :8787.
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const SERVER = 'http://localhost:8787';

/** /tv and /hub open tv.html and hub.html in development, as the server does with the built pages. */
const tvPage: Plugin = {
  name: 'pip-tv-page',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      for (const page of ['/tv', '/hub']) {
        if (req.url === page || req.url?.startsWith(`${page}?`))
          req.url = `${page}.html${req.url.slice(page.length)}`;
      }
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), tvPage],
  build: {
    rollupOptions: {
      input: {
        pad: fileURLToPath(new URL('./index.html', import.meta.url)),
        tv: fileURLToPath(new URL('./tv.html', import.meta.url)),
        hub: fileURLToPath(new URL('./hub.html', import.meta.url)),
      },
    },
  },
  server: {
    proxy: {
      '/socket.io': { target: SERVER, ws: true },
      '/api': SERVER,
      '/qr': SERVER,
      '/media': SERVER,
    },
  },
});
