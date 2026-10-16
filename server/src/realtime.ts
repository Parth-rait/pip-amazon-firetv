// Socket.IO handlers. Thin: validate, find the session, call a module (PROJECT.md section 10.3).
import { randomBytes } from 'node:crypto';
import type { Socket } from 'socket.io';
import type { Config } from './config.js';
import type { TextModel } from './core/ai/model.js';
import type { AnswerCache } from './core/context/answer-cache.js';
import type { Timeline } from './core/context/timeline.js';
import { noJudge, type IntentJudge } from './core/intent/judge.js';
import { routeText } from './core/intent/route-text.js';
import { newCode } from './core/codes.js';
import { hostTimerKey, pickTvCode, startHostGrace } from './core/pairing.js';
import { pipTimerKey, restingPip, setPip, type CoreDeps } from './core/pip.js';
import { cleanName, joinPlayer, leaveSocket, pickHost } from './core/players.js';
import { createRateLimit } from './core/rate-limit.js';
import type { Timers } from './core/timers.js';
import type { Content } from './film/content.js';
import { quizTimerKey } from './film/quiz.js';
import { askPip, dismissAssist } from './assist-flow.js';
import {
  actionTimerKey,
  assistTimerKey,
  broadcast,
  goToLobby,
  roomOf,
  watchFilm,
  type FlowDeps,
  type PipServer,
} from './flow.js';
import { applyInput, observePlayback, sendPlayback } from './playback-flow.js';
import { errorFields, type log as Log } from './log.js';
import type { Session, SessionStore } from './sessions.js';
import {
  LIMITS,
  type AskResult,
  type ClientToServerEvents,
  type HelloResult,
  type InputResult,
} from './shared/protocol.js';
import * as schema from './validate.js';
import { buildView } from './view.js';

export interface RealtimeDeps {
  io: PipServer;
  store: SessionStore;
  films: Content[];
  config: Config;
  timers: Timers;
  model: TextModel;
  timelines: Map<string, Timeline>; // one per film; empty when a film has no timeline yet
  cache: AnswerCache;
  judge?: IntentJudge;
  log: typeof Log;
  now: () => number;
}

type PipSocket = Socket<ClientToServerEvents>;
type SocketData = { role: 'tv'; code: string } | { role: 'pad'; code: string; playerId: string };

const SWEEP_EVERY_MS = 10 * 60 * 1000;
const JOIN_WINDOW_MS = 60 * 1000;

/** Registers every handler; returns a function that stops the idle sweep. */
export function registerRealtime(deps: RealtimeDeps): () => void {
  const features = { quiz: deps.config.QUIZ_ENABLED };
  const flow: FlowDeps = {
    io: deps.io,
    films: deps.films,
    publicUrl: deps.config.PUBLIC_URL,
    timers: deps.timers,
    now: deps.now,
    timelines: deps.timelines,
    features,
    judge: deps.judge ?? noJudge,
    log: deps.log,
    answer: {
      model: deps.model,
      modelId: deps.config.BEDROCK_MODEL_ID,
      aiEnabled: deps.config.AI_ENABLED,
      cache: deps.cache,
      policy: deps.config.TIMELINE_REVIEW,
      now: deps.now,
    },
  };
  const joinLimit = createRateLimit(LIMITS.failedJoinsPerMinute, JOIN_WINDOW_MS);
  const core = (session: Session): CoreDeps => ({
    timers: deps.timers,
    broadcast: () => broadcast(session, flow),
    now: deps.now,
  });

  deps.io.on('connection', (socket: PipSocket) => {
    deps.log.info('socket.connect', { socketId: socket.id });
    const data = (): SocketData | undefined => socket.data as SocketData | undefined;
    const sessionOf = () => {
      const d = data();
      return d ? deps.store.get(d.code) : undefined;
    };
    // Payloads arrive untyped from the wire, so handlers take unknown and validate it themselves.
    const untyped = socket as unknown as Socket;
    // One throw in a handler stops the whole server, so every handler runs inside this guard.
    const on = (event: keyof ClientToServerEvents, handler: (...args: unknown[]) => void) => {
      untyped.on(event, (...args: unknown[]) => {
        try {
          handler(...args);
        } catch (error) {
          deps.log.error(`failed.${event}`, { socketId: socket.id, ...errorFields(error) });
        }
      });
    };
    const invalid = (event: string) => deps.log.warn(`invalid.${event}`, { socketId: socket.id });
    const ignored = (event: string, why: string) =>
      deps.log.info(`ignored.${event}`, { socketId: socket.id, code: data()?.code, why });

    /** Leaves the current session as on disconnect: TV seat, or the player's socket. */
    const leaveCurrent = () => {
      const d = data();
      const session = sessionOf();
      socket.data = undefined;
      if (!d || !session) return;
      void socket.leave(roomOf(session.code));
      if (d.role === 'tv') {
        if (session.tvSocketId === socket.id) session.tvSocketId = null;
        broadcast(session, flow);
        return;
      }
      const wasLast = leaveSocket(session, d.playerId, socket.id, deps.now());
      if (wasLast && session.hostId === d.playerId) startHostGrace(session, core(session));
      if (restingPip(session) === 'sleep' && session.pip !== 'sleep')
        setPip(session, 'sleep', core(session));
      else broadcast(session, flow);
    };

    on('sys:ping', (payload, ack) => {
      if (typeof ack !== 'function') return invalid('sys:ping');
      const parsed = schema.pingSchema.safeParse(payload);
      if (!parsed.success) return invalid('sys:ping');
      ack({ sentAt: parsed.data.sentAt, serverAt: deps.now() });
    });

    on('tv:hello', (payload, ack) => {
      if (typeof ack !== 'function') return invalid('tv:hello');
      const parsed = schema.helloSchema.safeParse(payload);
      if (!parsed.success) {
        invalid('tv:hello');
        return ack({ ok: false, reason: 'invalid' } satisfies HelloResult);
      }
      const hello = parsed.data;
      if (data()) leaveCurrent();
      const now = deps.now();
      const choice = pickTvCode(hello, (code) => deps.store.get(code)?.tvKey);
      let session: Session;
      if (choice.kind === 'reuse') {
        session = deps.store.get(choice.code) as Session;
        const older = session.tvSocketId;
        session.tvSocketId = socket.id; // record the new socket first, so the old one's disconnect is harmless
        if (older && older !== socket.id) deps.io.sockets.sockets.get(older)?.disconnect(true);
      } else if (choice.kind === 'restore') {
        session = deps.store.create(choice.code, hello.tvKey ?? newTvKey(), socket.id, now);
        resumeFilm(session, hello.playback, deps.films, now);
      } else {
        session = deps.store.create(uniqueCode(deps.store), newTvKey(), socket.id, now);
      }
      socket.data = { role: 'tv', code: session.code } satisfies SocketData;
      void socket.join(roomOf(session.code));
      const base = deps.config.PUBLIC_URL;
      ack({
        ok: true,
        code: session.code,
        tvKey: session.tvKey,
        padUrl: `${base}/?code=${session.code}`,
        qrUrl: `${base}/qr/${session.code}`,
      });
      deps.log.info('tv.hello', { socketId: socket.id, code: session.code, kind: choice.kind });
      broadcast(session, flow);
    });

    on('pad:join', (payload, ack) => {
      if (typeof ack !== 'function') return invalid('pad:join');
      const parsed = schema.joinSchema.safeParse(payload);
      const name = parsed.success ? cleanName(parsed.data.name) : null;
      if (!parsed.success || name === null) {
        invalid('pad:join');
        return ack({ ok: false, reason: 'invalid' });
      }
      const { code, playerId } = parsed.data;
      const now = deps.now();
      let session = deps.store.get(code);
      if (!session?.players.has(playerId)) {
        const address = clientAddress(socket);
        if (joinLimit.isLimited(address, now)) return ack({ ok: false, reason: 'rate-limited' });
        if (!session) {
          joinLimit.record(address, now);
          return ack({ ok: false, reason: 'unknown-code' });
        }
      }
      const current = data();
      if (
        current &&
        (current.code !== code || current.role !== 'pad' || current.playerId !== playerId)
      ) {
        leaveCurrent();
        session = deps.store.get(code);
        if (!session) return ack({ ok: false, reason: 'unknown-code' });
      }
      const outcome = joinPlayer(session, { playerId, name, socketId: socket.id }, now);
      if (!outcome.ok) return ack({ ok: false, reason: outcome.reason });
      pickHost(session, now);
      socket.data = { role: 'pad', code, playerId } satisfies SocketData;
      void socket.join(roomOf(code));
      ack({
        ok: true,
        view: buildView(session, deps.films, deps.config.PUBLIC_URL, now, features),
      });
      deps.log.info('pad.join', { socketId: socket.id, code, playerId, isNew: outcome.isNew });
      if (session.pip === 'sleep') setPip(session, 'idle', core(session));
      else broadcast(session, flow);
    });

    on('pad:host', (payload) => {
      const parsed = schema.hostCommandSchema.safeParse(payload);
      if (!parsed.success) return invalid('pad:host');
      const d = data();
      const session = sessionOf();
      if (!session || d?.role !== 'pad' || session.hostId !== d.playerId) {
        return ignored('pad:host', 'not-host');
      }
      const command = parsed.data;
      const stage = session.stage;
      if (command.type === 'watch' && (stage === 'lobby' || stage === 'results')) {
        if (!watchFilm(session, command.contentId, flow)) ignored('pad:host', 'unknown-film');
      } else if (
        (command.type === 'play' || command.type === 'pause' || command.type === 'seek') &&
        stage === 'watch'
      ) {
        const intent =
          command.type === 'seek'
            ? { type: 'seek' as const, deltaSec: command.deltaSec }
            : { type: command.type };
        const sent = sendPlayback(session, intent, d.playerId, command.commandId ?? null, flow);
        if (!sent.ok) ignored('pad:host', sent.reason);
      } else if (command.type === 'lobby' && stage !== 'lobby') {
        goToLobby(session, flow);
      } else {
        ignored('pad:host', `${command.type}-in-${stage}`);
      }
    });

    on('tv:watch', (payload) => {
      const parsed = schema.tvWatchSchema.safeParse(payload);
      if (!parsed.success) return invalid('tv:watch');
      const session = sessionOf();
      if (!session || session.tvSocketId !== socket.id) return ignored('tv:watch', 'not-tv');
      if (session.stage !== 'lobby') return ignored('tv:watch', `in-${session.stage}`);
      if (!watchFilm(session, parsed.data.contentId, flow)) ignored('tv:watch', 'unknown-film');
    });

    on('tv:playback', (payload) => {
      const parsed = schema.playbackSchema.safeParse(payload);
      if (!parsed.success) return invalid('tv:playback');
      const session = sessionOf();
      if (!session || session.tvSocketId !== socket.id) return ignored('tv:playback', 'not-tv');
      if (parsed.data.contentId !== session.contentId) return ignored('tv:playback', 'other-film');
      session.playback = parsed.data;
      session.playbackAt = deps.now();
      observePlayback(session, flow);
      broadcast(session, flow);
    });

    on('pad:ask', (payload, ack) => {
      if (typeof ack !== 'function') return invalid('pad:ask');
      const reply = (result: AskResult) => ack(result);
      const parsed = schema.askSchema.safeParse(payload);
      const d = data();
      const session = sessionOf();
      if (!parsed.success || !session || d?.role !== 'pad' || !session.players.has(d.playerId)) {
        invalid('pad:ask');
        return reply({ ok: false, reason: 'invalid' });
      }
      const player = session.players.get(d.playerId);
      const now = deps.now();
      if (session.stage !== 'watch') return reply({ ok: false, reason: 'not-watching' });
      // Commands never wait for a model, so only a question is "busy" while another is answered.
      if (session.asking && routeText(parsed.data.text).kind === 'question') {
        return reply({ ok: false, reason: 'busy' });
      }
      if (player && now - player.lastAskAt < LIMITS.askMinIntervalMs) {
        return reply({ ok: false, reason: 'too-soon' });
      }
      reply({ ok: true });
      deps.log.info('ask.start', {
        code: session.code,
        playerId: d.playerId,
        via: parsed.data.via,
        ...(deps.config.LOG_TEXT ? { text: parsed.data.text } : {}),
      });
      askPip(session, d.playerId, parsed.data.text, parsed.data.via, flow).catch(
        (error: unknown) => {
          session.asking = false;
          deps.log.error('failed.ask', { code: session.code, ...errorFields(error) });
        },
      );
    });

    on('pad:assist', (payload) => {
      const parsed = schema.assistSchema.safeParse(payload);
      if (!parsed.success) return invalid('pad:assist');
      const d = data();
      const session = sessionOf();
      if (!session || d?.role !== 'pad' || !session.players.has(d.playerId)) {
        return ignored('pad:assist', 'not-in-session');
      }
      session.journal.append({
        at: deps.now(),
        type: 'assist.dismiss',
        source: 'pad',
        actor: d.playerId,
        data: {},
      });
      dismissAssist(session, flow);
    });

    on('pad:input', (payload, ack) => {
      if (typeof ack !== 'function') return invalid('pad:input');
      const parsed = schema.inputSchema.safeParse(payload);
      const d = data();
      const session = sessionOf();
      if (!parsed.success || !session || d?.role !== 'pad' || !session.players.has(d.playerId)) {
        invalid('pad:input');
        return ack({ ok: false, reason: 'invalid' } satisfies InputResult);
      }
      ack(applyInput(session, parsed.data, { kind: 'pad', playerId: d.playerId }, flow));
    });

    on('tv:input', (payload) => {
      const parsed = schema.inputSchema.safeParse(payload);
      if (!parsed.success) return invalid('tv:input');
      const session = sessionOf();
      if (!session || session.tvSocketId !== socket.id) return ignored('tv:input', 'not-tv');
      const result = applyInput(session, parsed.data, { kind: 'tv' }, flow);
      if (!result.ok) ignored('tv:input', result.reason);
    });

    socket.on('disconnect', (reason) => {
      try {
        deps.log.info('socket.disconnect', { socketId: socket.id, code: data()?.code, reason });
        leaveCurrent();
      } catch (error) {
        deps.log.error('failed.disconnect', { socketId: socket.id, ...errorFields(error) });
      }
    });
  });

  const sweep = setInterval(() => {
    for (const code of deps.store.sweep(deps.now())) {
      const keys = [pipTimerKey(code), hostTimerKey(code), quizTimerKey(code)];
      for (const key of [...keys, assistTimerKey(code), actionTimerKey(code)])
        deps.timers.clear(key);
      deps.log.info('session.expired', { code });
    }
  }, SWEEP_EVERY_MS);
  sweep.unref();
  return () => clearInterval(sweep);
}

function newTvKey(): string {
  return randomBytes(16).toString('hex');
}

function uniqueCode(store: SessionStore): string {
  let code = newCode();
  while (store.get(code)) code = newCode();
  return code;
}

/** Behind the tunnel every socket comes from localhost, so Cloudflare's header names the client. */
function clientAddress(socket: PipSocket): string {
  const header = socket.handshake.headers['cf-connecting-ip'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  return fromHeader || socket.handshake.address;
}

/** After a server restart, a TV that was playing a known film carries on in watch. */
function resumeFilm(
  session: Session,
  playback: Session['playback'],
  films: Content[],
  now: number,
): void {
  if (!playback || playback.ended || !films.some((f) => f.id === playback.contentId)) return;
  session.stage = 'watch';
  session.contentId = playback.contentId;
  session.playback = playback;
  session.playbackAt = now;
}
