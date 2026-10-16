// The Virtual Pip Lab: the real server on a random port, with a manual clock, fake timers that
// fire on demand, a fake model and captured logs. Fake TVs and pads talk to it over real sockets.
import type { AddressInfo } from 'node:net';
import { parseConfig } from '../config.js';
import { lanternFoxTimeline } from '../core/context/fixture.js';
import type { Timeline } from '../core/context/timeline.js';
import type { TextModel } from '../core/ai/model.js';
import { createFakeTimers, type FakeTimers } from '../core/fake-timers.js';
import type { Content } from '../film/content.js';
import type { log as Log } from '../log.js';
import { createPipServer, type PipServer } from '../server.js';
import type { Session } from '../sessions.js';
import { FakePad } from './fake-pad.js';
import { FakeTv } from './fake-tv.js';
import { groundedModel } from './models.js';

/** The lab film: our original fixture story, 96 seconds. */
export const LAB_FILM: Content = {
  id: 'lantern-fox',
  title: 'The Lantern Fox',
  url: '/media/lantern-fox.mp4',
  credit: 'The Lantern Fox, an original test film by the Pip project (MIT)',
  durationSec: 96,
  premise: 'A small fox explores a snowy forest at night.',
  notes: [],
  quiz: [],
};

export interface LabOptions {
  model?: TextModel;
  env?: Record<string, string>; // server config overrides, as in server/.env
  timeline?: Timeline;
}

export interface Lab {
  url: string;
  clock: { now(): number; advance(ms: number): void };
  timers: FakeTimers;
  logs: Record<string, unknown>[];
  server: PipServer;
  tv(): FakeTv;
  pad(name: string): FakePad;
  session(): Session | undefined;
  restart(): Promise<void>;
  stop(): Promise<void>;
}

/** Polls until `check` returns a truthy value; fails with `what` after the timeout. */
export async function waitFor<T>(
  check: () => T | null | undefined | false,
  what: string,
  timeoutMs = 2000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`lab: timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function captureLog(lines: Record<string, unknown>[]): typeof Log {
  const write =
    (level: string) =>
    (event: string, fields: Record<string, unknown> = {}) =>
      void lines.push({ level, event, ...fields });
  return { info: write('info'), warn: write('warn'), error: write('error') };
}

export async function startLab(options: LabOptions = {}): Promise<Lab> {
  let nowMs = 1_000_000;
  const clock = { now: () => nowMs, advance: (ms: number) => void (nowMs += ms) };
  const timers = createFakeTimers();
  const logs: Record<string, unknown>[] = [];
  const config = parseConfig({ AI_ENABLED: 'true', ...options.env });
  const timelines = new Map([[LAB_FILM.id, options.timeline ?? lanternFoxTimeline()]]);
  const clients: { close(): void }[] = [];
  const build = () =>
    createPipServer({
      config,
      films: [LAB_FILM],
      timelines,
      model: options.model ?? groundedModel(),
      timers,
      log: captureLog(logs),
      now: clock.now,
    });

  let server = build();
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  const port = (server.httpServer.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}`;

  const lab: Lab = {
    url,
    clock,
    timers,
    logs,
    get server() {
      return server;
    },
    tv() {
      const tv = new FakeTv({ url, now: clock.now });
      clients.push(tv);
      return tv;
    },
    pad(name) {
      const pad = new FakePad(url, name);
      clients.push(pad);
      return pad;
    },
    session() {
      const code = [...server.io.of('/').sockets.values()]
        .map((s) => (s.data as { code?: string } | undefined)?.code)
        .find(Boolean);
      return code ? server.store.get(code) : undefined;
    },
    async restart() {
      await server.close();
      server = build();
      await new Promise<void>((resolve) => server.httpServer.listen(port, resolve));
    },
    async stop() {
      clients.forEach((c) => c.close());
      await server.close();
    },
  };
  return lab;
}
