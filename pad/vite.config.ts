// Vite config: React, two pages (the pad at /, the browser TV at /tv), and a dev proxy so both on
// :5173 talk to the server on :8787.
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const SERVER = 'http://localhost:8787';

/** /tv opens tv.html in development, as the server does with the built pages. */
const tvPage: Plugin = {
  name: 'pip-tv-page',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/tv' || req.url?.startsWith('/tv?')) req.url = `/tv.html${req.url.slice(3)}`;
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
