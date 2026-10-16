// Vite config: React, two pages (the pad and the TV simulator), and a dev proxy so they talk to
// the server on :8787.
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const SERVER = 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        pad: fileURLToPath(new URL('index.html', import.meta.url)),
        tv: fileURLToPath(new URL('tv.html', import.meta.url)),
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
