// The vision-language step of video understanding: one local model call per sampled frame, through
// Ollama's HTTP API (Qwen-VL family; docs/extractions/video-understanding.md says why). The prompt
// carries the characters seen so far, so the model links a character to an earlier one by looking
// at it. Output is UNTRUSTED: it is parsed leniently, kept raw, and only becomes candidate facts.
import { createHash } from 'node:crypto';
import { z } from 'zod';

export const VLM_PROMPT_VERSION = 'vu1';
const MAX_CHARACTERS = 4;

export type CharacterKind = 'person' | 'animal' | 'creature' | 'other';

/** What the model saw in one frame, after parsing. `match` is a roster id or null for "new". */
export interface FrameObservation {
  characters: { match: string | null; kind: CharacterKind; looks: string; doing: string }[];
  action: string;
  setting: string;
  objects: string[];
  textOnScreen: string;
}

/** A character the prompt lists so the model can say "this is c2 again". */
export interface RosterLine {
  id: string;
  kind: CharacterKind;
  looks: string;
}

export function framePrompt(roster: RosterLine[]): string {
  const known = roster.length
    ? roster.map((r) => `${r.id}: ${r.looks} (${r.kind})`).join('\n')
    : 'none yet';
  return [
    'You are describing one frame of an animated film for a scene log.',
    `Characters already seen (id: what they look like):\n${known}`,
    'Reply with JSON only, in this shape:',
    '{"characters":[{"match":"c1 or new","kind":"person","looks":"young woman with red hair","doing":"holds a sword"}],' +
      '"action":"one short sentence about what is happening","setting":"short place description",' +
      '"objects":["up to 4 important objects"],"text_on_screen":""}',
    'Rules: list at most 4 clearly visible characters (people, animals or creatures). "match" is the id ' +
      'of a character above only if it is clearly the same one, otherwise "new". "kind" is person, ' +
      'animal or creature. "looks" is 3 to 8 words about appearance (age, size, hair, clothes, colour). ' +
      'Describe only what you see. Never use names. If no character is visible, use an empty list.',
  ].join('\n');
}

/** Asks which visible character a spoken name belongs to. */
export function namingPrompt(line: string, name: string, roster: RosterLine[]): string {
  return [
    'This is a frame of an animated film. At this moment someone says:',
    `"${line}"`,
    `Which character in the frame is called "${name}"? The characters here are:`,
    roster.map((r) => `${r.id}: ${r.looks} (${r.kind})`).join('\n'),
    'Reply with JSON only: {"who":"c1","sure":true}. Use "who":"unknown" if the frame does not show ' +
      'who is called that, for example when the speaker says their own name or nobody fits.',
  ].join('\n');
}

const KINDS: CharacterKind[] = ['person', 'animal', 'creature', 'other'];

function asText(value: unknown, max: number): string {
  if (typeof value === 'string') return value.trim().replace(/\s+/g, ' ').slice(0, max);
  // Small models sometimes nest a description: {"description": "..."}.
  if (value && typeof value === 'object') {
    const text = Object.values(value as Record<string, unknown>).find((v) => typeof v === 'string');
    return typeof text === 'string' ? asText(text, max) : '';
  }
  return '';
}

function asKind(value: unknown): CharacterKind {
  const text = asText(value, 20).toLowerCase();
  if (KINDS.includes(text as CharacterKind)) return text as CharacterKind;
  if (/dragon|monster|beast|creature/.test(text)) return 'creature';
  if (/animal|bird|dog|cat|rabbit|chicken|fox/.test(text)) return 'animal';
  if (/person|man|woman|girl|boy|human|child/.test(text)) return 'person';
  return 'other';
}

/** The JSON object in a model reply, which may come wrapped in prose or code fences. */
export function jsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const value: unknown = JSON.parse(raw.slice(start, end + 1));
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Parses a frame reply. `rosterIds` are the ids the prompt offered: any other "match" (an invented
 * id, a name, "c1 or new") counts as new. Returns null when the reply has no usable JSON.
 */
export function parseObservation(raw: string, rosterIds: string[]): FrameObservation | null {
  const json = jsonObject(raw);
  if (!json) return null;
  const list = Array.isArray(json.characters) ? json.characters : [];
  const characters = list
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c) => {
      const match = asText(c.match, 20).toLowerCase();
      return {
        match: rosterIds.includes(match) ? match : null,
        kind: asKind(c.kind),
        looks: asText(c.looks ?? c.description, 80),
        doing: asText(c.doing ?? c.action, 80),
      };
    })
    .filter((c) => c.looks.length > 0)
    .slice(0, MAX_CHARACTERS);
  const objects = (Array.isArray(json.objects) ? json.objects : [])
    .map((o) => asText(o, 40))
    .filter(Boolean)
    .slice(0, 4);
  return {
    characters,
    action: asText(json.action ?? json.summary, 200),
    setting: asText(json.setting, 80),
    objects,
    textOnScreen: asText(json.text_on_screen, 80),
  };
}

/** Parses a naming reply: a roster id from `allowed`, or null. */
export function parseNaming(raw: string, allowed: string[]): { who: string | null; sure: boolean } {
  const json = jsonObject(raw);
  const who = asText(json?.who, 20).toLowerCase();
  return { who: allowed.includes(who) ? who : null, sure: json?.sure === true };
}

export function promptHash(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

const tagsSchema = z.object({
  models: z.array(z.object({ name: z.string(), digest: z.string() })),
});
const generateSchema = z.object({
  response: z.string().optional(),
  error: z.string().optional(),
  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional(),
});

export interface VisionModel {
  model: string;
  digest: string;
  /** One image and one prompt; resolves to the raw reply and the time it took. */
  ask(prompt: string, jpeg: Buffer): Promise<{ raw: string; ms: number }>;
}

/** A vision model served by a local Ollama. Fails fast when the model is not installed. */
export async function ollamaVision(baseUrl: string, model: string): Promise<VisionModel> {
  const tags = tagsSchema.parse(await (await fetch(`${baseUrl}/api/tags`)).json());
  const digest = tags.models.find((m) => m.name === model)?.digest;
  if (!digest) throw new Error(`${model} is not installed in Ollama (ollama pull ${model})`);
  return {
    model,
    digest,
    async ask(prompt, jpeg) {
      const started = Date.now();
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          images: [jpeg.toString('base64')],
          stream: false,
          format: 'json',
          keep_alive: '10m',
          // A smaller context keeps more of the model on the GPU of an 8 GB Mac; image (~1,080
          // tokens) + prompt + reply fit in 2,560.
          options: { temperature: 0, num_predict: 350, num_ctx: 2560, seed: 7 },
        }),
        signal: AbortSignal.timeout(180_000),
      });
      const body = generateSchema.parse(await res.json());
      if (!res.ok || body.error) throw new Error(`ollama: ${body.error ?? res.status}`);
      return { raw: body.response ?? '', ms: Date.now() - started };
    },
  };
}
