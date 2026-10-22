// The Command Center's data (/hub): what Pip is, knows and does right now. Read-only, and only for
// requests from this machine: through the tunnel the answer is 403, so the household's sessions,
// journal and film facts never leave the house.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Request } from 'express';
import type { Config } from './config.js';
import type { Timeline } from './core/context/timeline.js';
import { isOnline } from './core/players.js';
import type { Content } from './film/content.js';
import { estimatePosition } from './film/playback.js';
import type { SessionStore } from './sessions.js';
import type { HubFact, HubSnapshot } from './shared/protocol.js';

const PING_TIMEOUT_MS = 1500;
const RECENT_EVENTS = 30;

export interface HubDeps {
  config: Config;
  films: Content[];
  timelines?: Map<string, Timeline>;
  store: SessionStore;
  journalDir?: string; // where the event journal is written, when JOURNAL=true
  resultsDir?: string; // docs/evaluation/results, for the latest benchmark per film
  now: () => number;
  fetch?: typeof fetch;
}

export interface Hub {
  snapshot(): Promise<HubSnapshot>;
  facts(filmId: string): HubFact[] | null;
}

/** True only for a request made on this machine, not one relayed by the tunnel. */
export function isLocalRequest(req: Request): boolean {
  if (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']) return false;
  const address = req.socket.remoteAddress ?? '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

export function createHub(deps: HubDeps): Hub {
  const doFetch = deps.fetch ?? fetch;
  return {
    async snapshot() {
      return {
        brain: await brain(deps.config, doFetch),
        sessions: deps.store.all().map((s) => {
          const film = deps.films.find((f) => f.id === s.contentId);
          const position = s.playback
            ? estimatePosition(s.playback, s.playbackAt, deps.now())
            : null;
          return {
            code: s.code,
            stage: s.stage,
            film: film?.title ?? null,
            positionSec: position === null ? null : Math.round(position),
            paused: s.playback ? s.playback.paused : null,
            tvOnline: s.tvSocketId !== null,
            kidsMode: s.kidsMode,
            assistantOpen: s.assistant.open,
            players: [...s.players.values()].map((p) => ({
              name: p.name,
              online: isOnline(p),
              isHost: p.id === s.hostId,
            })),
            device: {
              volume: s.device.volume,
              brightness: s.device.brightness,
              ambient: s.device.ambient,
            },
          };
        }),
        library: deps.films.map((film) => {
          const timeline = deps.timelines?.get(film.id);
          return {
            id: film.id,
            title: film.title,
            durationSec: film.durationSec,
            poster: film.poster ?? null,
            credit: film.credit,
            tags: film.tags,
            facts: timeline?.facts.filter((f) => f.review === 'accepted').length ?? 0,
            candidates: timeline?.facts.filter((f) => f.review === 'candidate').length ?? 0,
            characters: timeline?.entities.length ?? 0,
            scenes: film.chapters.length,
            benchmark: latestBenchmark(deps.resultsDir, film.id),
          };
        }),
        memory: journalToday(deps.config.JOURNAL, deps.journalDir, deps.now()),
        settings: {
          AI_PROVIDER: deps.config.AI_PROVIDER,
          OLLAMA_MODEL: deps.config.OLLAMA_MODEL,
          AI_ENABLED: String(deps.config.AI_ENABLED),
          TIMELINE_REVIEW: deps.config.TIMELINE_REVIEW,
          ANSWER_MEMORY: String(deps.config.ANSWER_MEMORY),
          JOURNAL: String(deps.config.JOURNAL),
          LOG_TEXT: String(deps.config.LOG_TEXT),
          INTENT_JUDGE: deps.config.INTENT_JUDGE,
          LAB_CONTENT: String(deps.config.LAB_CONTENT),
          PUBLIC_URL: deps.config.PUBLIC_URL,
        },
      };
    },
    facts(filmId) {
      const timeline = deps.timelines?.get(filmId);
      if (!timeline) return null;
      return timeline.facts.map((f) => ({
        atSec: f.startSec,
        revealSec: f.revealSec,
        text: f.text,
        review: f.review,
      }));
    },
  };
}

async function brain(config: Config, doFetch: typeof fetch): Promise<HubSnapshot['brain']> {
  const base = {
    provider: config.AI_PROVIDER,
    model: config.AI_PROVIDER === 'ollama' ? config.OLLAMA_MODEL : config.BEDROCK_MODEL_ID,
    aiEnabled: config.AI_ENABLED,
    timelineReview: config.TIMELINE_REVIEW,
  };
  if (config.AI_PROVIDER !== 'ollama') return { ...base, reachable: null, latencyMs: null };
  const started = Date.now();
  try {
    const res = await doFetch(`${config.OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    const body = (await res.json()) as { models?: { name: string }[] };
    const hasModel = (body.models ?? []).some((m) => m.name === config.OLLAMA_MODEL);
    return { ...base, reachable: res.ok && hasModel, latencyMs: Date.now() - started };
  } catch {
    return { ...base, reachable: false, latencyMs: null };
  }
}

/** Today's journal: counts by type and the latest events, with no subject ids and no data. */
function journalToday(
  isOn: boolean,
  dir: string | undefined,
  nowMs: number,
): HubSnapshot['memory'] {
  const empty = { journalOn: isOn, eventsToday: 0, byType: {}, recent: [] };
  if (!isOn || !dir) return empty;
  const file = join(dir, `events-${new Date(nowMs).toISOString().slice(0, 10)}.jsonl`);
  if (!existsSync(file)) return empty;
  const events = readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [
          JSON.parse(line) as {
            timestamp_utc: string;
            event_type: string;
            source: string;
            content_id?: string | null;
          },
        ];
      } catch {
        return [];
      }
    });
  const byType: Record<string, number> = {};
  for (const e of events) byType[e.event_type] = (byType[e.event_type] ?? 0) + 1;
  return {
    journalOn: true,
    eventsToday: events.length,
    byType,
    recent: events
      .slice(-RECENT_EVENTS)
      .reverse()
      .map((e) => ({
        at: e.timestamp_utc,
        type: e.event_type,
        source: e.source,
        film: e.content_id ?? null,
      })),
  };
}

/** The newest benchmark file for a film, its local-model row if there is one. */
function latestBenchmark(
  dir: string | undefined,
  filmId: string,
): HubSnapshot['library'][number]['benchmark'] {
  if (!dir || !existsSync(dir)) return null;
  const file = readdirSync(dir)
    .filter((name) => name.endsWith(`-${filmId}.json`))
    .sort()
    .at(-1);
  if (!file) return null;
  try {
    const data = JSON.parse(readFileSync(join(dir, file), 'utf8')) as {
      summaries: {
        strategy: string;
        leaks: number;
        spoilerProbes: number;
        answered: number;
        answerExpected: number;
      }[];
    };
    const row =
      data.summaries.find((s) => s.strategy.startsWith('Ollama')) ?? data.summaries[0] ?? null;
    return row
      ? {
          leaks: row.leaks,
          probes: row.spoilerProbes,
          answered: row.answered,
          answerable: row.answerExpected,
        }
      : null;
  } catch {
    return null;
  }
}
