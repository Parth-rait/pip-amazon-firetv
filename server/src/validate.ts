// zod schemas for every payload a client sends (PROJECT.md section 10.4). Update with protocol.ts.
import { z } from 'zod';
import {
  CODE_ALPHABET,
  LIMITS,
  type AskVia,
  type ClientToServerEvents,
  type HostCommand,
  type InputEnvelope,
  type Playback,
} from './shared/protocol.js';

type PayloadOf<E extends keyof ClientToServerEvents> = Parameters<ClientToServerEvents[E]>[0];

const MAX_FILM_SEC = 24 * 60 * 60;
const CONTENT_ID_MAX_CHARS = 80;
const NAME_RAW_MAX_CHARS = 100; // cleanName applies the real limit after removing spaces

const code = z.string().regex(new RegExp(`^[${CODE_ALPHABET}]{${LIMITS.codeLength}}$`));
const hexId = z.string().regex(/^[0-9a-f]{32}$/);
const contentId = z.string().min(1).max(CONTENT_ID_MAX_CHARS);
const eventId = z
  .string()
  .regex(new RegExp(`^[A-Za-z0-9_-]{${LIMITS.eventIdMinChars},${LIMITS.eventIdMaxChars}}$`));
const seconds = z
  .number()
  .finite()
  .transform((n) => Math.min(Math.max(n, 0), MAX_FILM_SEC));

export const pingSchema: z.ZodType<PayloadOf<'sys:ping'>> = z.object({
  sentAt: z.number().finite(),
});

export const playbackSchema: z.ZodType<Playback> = z.object({
  contentId,
  positionSec: seconds,
  durationSec: seconds,
  paused: z.boolean(),
  ended: z.boolean(),
});

export const helloSchema: z.ZodType<PayloadOf<'tv:hello'>> = z.object({
  previousCode: code.nullable(),
  tvKey: hexId.nullable(),
  playback: playbackSchema.nullable(),
});

export const tvWatchSchema: z.ZodType<PayloadOf<'tv:watch'>> = z.object({ contentId });

export const joinSchema: z.ZodType<PayloadOf<'pad:join'>> = z.object({
  code,
  playerId: hexId,
  name: z.string().max(NAME_RAW_MAX_CHARS),
});

export const hostCommandSchema: z.ZodType<HostCommand> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('watch'), contentId }),
  z.object({ type: z.literal('play'), commandId: eventId.optional() }),
  z.object({ type: z.literal('pause'), commandId: eventId.optional() }),
  z.object({
    type: z.literal('seek'),
    deltaSec: z
      .number()
      .finite()
      .transform((n) => Math.min(Math.max(n, -LIMITS.seekMaxAbsSec), LIMITS.seekMaxAbsSec)),
    commandId: eventId.optional(),
  }),
  z.object({ type: z.literal('start-quiz') }),
  z.object({
    type: z.literal('next'),
    index: z.number().int().min(0),
    phase: z.enum(['question', 'reveal']),
  }),
  z.object({ type: z.literal('lobby') }),
]);

const askVia: z.ZodType<AskVia> = z.enum(['typed', 'voice', 'starter', 'next', 'clarify']);

export const askSchema: z.ZodType<PayloadOf<'pad:ask'>> = z.object({
  text: z.string().trim().min(2).max(LIMITS.askMaxChars),
  via: askVia,
});

export const answerSchema: z.ZodType<PayloadOf<'pad:answer'>> = z.object({
  index: z.number().int().min(0),
  choice: z.number().int().min(0).max(3),
});

export const assistSchema: z.ZodType<PayloadOf<'pad:assist'>> = z.object({
  type: z.literal('dismiss'),
});

const MAX_WHEEL_DETENTS = 24;

export const inputSchema: z.ZodType<InputEnvelope> = z.object({
  v: z.literal(1),
  eventId,
  source: z.enum(['pad-touch', 'pad-button', 'pad-wheel', 'remote', 'keyboard', 'sim']),
  sentAt: z.number().finite(),
  input: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('key'),
      key: z.enum(['play-pause', 'play', 'pause', 'rewind', 'fast-forward', 'left', 'right', 'back']),
    }),
    z.object({ kind: z.literal('button'), gesture: z.enum(['press', 'double-press', 'long-press']) }),
    z.object({
      kind: z.literal('wheel'),
      detents: z.number().int().min(-MAX_WHEEL_DETENTS).max(MAX_WHEEL_DETENTS),
    }),
  ]),
});
