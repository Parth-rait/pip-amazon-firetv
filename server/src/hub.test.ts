import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { parseConfig } from './config.js';
import { loadFilms } from './film/content.js';
import { loadTimeline } from './film/timeline-file.js';
import { createHub } from './hub.js';
import { InMemorySessionStore } from './sessions.js';
import type { HubFact, HubSnapshot } from './shared/protocol.js';

const CONTENT = new URL('../content/', import.meta.url).pathname;
const config = parseConfig({ PUBLIC_URL: 'https://pip.example.com', JOURNAL: 'false' });
const films = loadFilms(CONTENT);
const timelines = new Map(films.map((f) => [f.id, loadTimeline(`${CONTENT}timelines`, f)]));
const store = new InMemorySessionStore();
const ollama = (async () =>
  new Response(JSON.stringify({ models: [{ name: config.OLLAMA_MODEL }] }))) as typeof fetch;

let baseUrl = '';
let close: () => void = () => {};

beforeAll(async () => {
  store.create('ABCD', 'k'.repeat(32), 'socket-1', 0);
  const hub = createHub({ config, films, timelines, store, now: () => 0, fetch: ollama });
  const server = createApp(config, films, { hub }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});

afterAll(() => close());

describe('the Command Center API', () => {
  it('describes the brain, the sessions and the library on this machine', async () => {
    const res = await fetch(`${baseUrl}/api/hub`);
    expect(res.status).toBe(200);
    const hub = (await res.json()) as HubSnapshot;
    expect(hub.brain).toMatchObject({ provider: 'ollama', reachable: true });
    expect(hub.sessions).toEqual([expect.objectContaining({ code: 'ABCD', tvOnline: true })]);
    const tears = hub.library.find((f) => f.id === 'tears-of-steel');
    expect(tears?.facts).toBeGreaterThan(30);
    expect(hub.memory.journalOn).toBe(false);
  });

  it('refuses requests relayed by the tunnel, so nothing leaves the house', async () => {
    const res = await fetch(`${baseUrl}/api/hub`, { headers: { 'cf-connecting-ip': '1.2.3.4' } });
    expect(res.status).toBe(403);
    const facts = await fetch(`${baseUrl}/api/hub/films/sintel/facts`, {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    expect(facts.status).toBe(403);
  });

  it("lists a film's facts locally, with their reveal times", async () => {
    const facts = (await (
      await fetch(`${baseUrl}/api/hub/films/sintel/facts`)
    ).json()) as HubFact[];
    expect(facts.length).toBeGreaterThan(30);
    expect(facts.every((f) => f.revealSec >= f.atSec)).toBe(true);
    expect((await fetch(`${baseUrl}/api/hub/films/nope/facts`)).status).toBe(404);
  });
});
