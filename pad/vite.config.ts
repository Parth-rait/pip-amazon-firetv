// Vite config: React, and a dev proxy so the pad on :5173 talks to the server on :8787.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const SERVER = 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': { target: SERVER, ws: true },
      '/api': SERVER,
      '/qr': SERVER,
      '/media': SERVER,
    },
  },
});
