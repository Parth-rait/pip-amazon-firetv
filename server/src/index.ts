// Starts the Pip server: HTTP (Express) and Socket.IO on one port.
import 'dotenv/config';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { loadFilms } from './film/content.js';
import { errorFields, log } from './log.js';
import type { ClientToServerEvents, ServerToClientEvents } from './shared/protocol.js';

const CONTENT_DIR = fileURLToPath(new URL('../content', import.meta.url));

const config = loadConfig();
const films = loadFilms(CONTENT_DIR);
const httpServer = createServer(createApp(config, films));
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);

io.on('connection', (socket) => {
  log.info('socket.connect', { socketId: socket.id });

  socket.on('sys:ping', (payload, ack) => {
    // Check the ack first: calling a missing ack throws, and one throw stops the server.
    if (typeof ack !== 'function') return;
    try {
      const sentAt = typeof payload?.sentAt === 'number' ? payload.sentAt : 0;
      ack({ sentAt, serverAt: Date.now() });
    } catch (error) {
      log.error('sys:ping.failed', { socketId: socket.id, ...errorFields(error) });
    }
  });

  socket.on('disconnect', (reason) => {
    log.info('socket.disconnect', { socketId: socket.id, reason });
  });
});

httpServer.listen(config.PORT, () => {
  log.info('server.start', {
    port: config.PORT,
    publicUrl: config.PUBLIC_URL,
    films: films.length,
    ai: config.AI_ENABLED,
  });
});
