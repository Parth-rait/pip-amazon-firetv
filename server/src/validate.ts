// zod schemas for every payload a client sends (PROJECT.md section 10.4). Update with protocol.ts.
import { z } from 'zod';
import {
  AVATAR_COLORS,
  CODE_ALPHABET,
  LIMITS,
  type AskVia,
  type ClientToServerEvents,
  type HostCommand,
  type Playback,
} from './shared/protocol.js';

type PayloadOf<E extends keyof ClientToServerEvents> = Parameters<ClientToServerEvents[E]>[0];

const MAX_FILM_SEC = 24 * 60 * 60;
const CONTENT_ID_MAX_CHARS = 80;
const NAME_RAW_MAX_CHARS = 100; // cleanName applies the real limit after removing spaces

const code = z.string().regex(new RegExp(`^[${CODE_ALPHABET}]{${LIMITS.codeLength}}$`));
const hexId = z.string().regex(/^[0-9a-f]{32}$/);
const contentId = z.string().min(1).max(CONTENT_ID_MAX_CHARS);
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
  avatar: z
    .number()
    .int()
    .min(0)
    .max(AVATAR_COLORS.length - 1)
    .optional(),
});

export const hostCommandSchema: z.ZodType<HostCommand> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('watch'), contentId }),
  z.object({ type: z.literal('play') }),
  z.object({ type: z.literal('pause') }),
  z.object({
    type: z.literal('seek'),
    deltaSec: z
      .number()
      .finite()
      .transform((n) => Math.min(Math.max(n, -LIMITS.seekMaxAbsSec), LIMITS.seekMaxAbsSec)),
  }),
  z.object({ type: z.literal('start-quiz') }),
  z.object({
    type: z.literal('next'),
    index: z.number().int().min(0),
    phase: z.enum(['question', 'reveal']),
  }),
  z.object({ type: z.literal('lobby') }),
  z.object({
    type: z.literal('pip-style'),
    style: z.object({
      mood: z.enum(['chill', 'playful', 'sassy']),
      color: z.enum(['mint', 'coral', 'lilac', 'sun']),
    }),
  }),
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
