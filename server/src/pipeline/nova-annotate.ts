// Optional candidate annotation with Amazon Nova through Bedrock Converse: one call per contact
// sheet, asking for timestamped facts that cite frame ids. Output is UNTRUSTED: it goes to the
// data folder as candidates for a person to review, never straight into a timeline.
// UNVERIFIED in this repo so far: Converse image blocks are checked against the installed SDK
// types (@aws-sdk/client-bedrock-runtime 3.1152.0), but Nova 2 Lite image input, limits and cost
// have not been confirmed with live AWS docs or credentials. Check them before relying on this.
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { candidateEntitySchema, candidateFactSchema, type CandidatesFile } from './artifacts.js';

export interface SheetInput {
  path: string; // PNG contact sheet
  frames: { id: string; atSec: number }[]; // the tiles, in reading order
}

const replySchema = z.object({
  entities: z.array(candidateEntitySchema.partial({ aliases: true })).default([]),
  facts: z.array(candidateFactSchema.omit({ id: true })).default([]),
});

const SYSTEM = `You label frames of a family film for a spoiler-safe assistant.
You get a contact sheet of frames in reading order and a list of their ids and times.
Describe only what is visible. Do not use outside knowledge of the film or guess what happens later.
Reply with JSON only: {"entities":[{"id":"","name":"","aliases":[],"firstSeenSec":0,"intro":""}],
"facts":[{"startSec":0,"revealSec":0,"kind":"event","text":"","entities":[],"spoilerTerms":[],"evidence":["frame id"],"confidence":0.5}]}
Rules: every fact cites at least one frame id from the list as evidence; revealSec is the time of
the latest frame it relies on; text is one or two plain sentences; say "a rabbit" rather than
inventing a name; confidence is lower when you are unsure.`;

function framesText(sheet: SheetInput): string {
  return sheet.frames.map((f) => `${f.id} at ${f.atSec.toFixed(1)}s`).join('\n');
}

/** Candidate facts for every sheet, merged. Throws on a Bedrock error; skips unusable replies. */
export async function annotateWithNova(options: {
  region: string;
  profile: string;
  modelId: string;
  assetId: string;
  sheets: SheetInput[];
  timeoutMs: number;
}): Promise<CandidatesFile> {
  const client = new BedrockRuntimeClient({
    region: options.region,
    profile: options.profile,
    maxAttempts: 2,
  });
  const entities = new Map<string, z.infer<typeof candidateEntitySchema>>();
  const facts: CandidatesFile['facts'] = [];
  for (const sheet of options.sheets) {
    const response = await client.send(
      new ConverseCommand({
        modelId: options.modelId,
        system: [{ text: SYSTEM }],
        messages: [
          {
            role: 'user',
            content: [
              { text: `Frames:\n${framesText(sheet)}` },
              { image: { format: 'png', source: { bytes: readFileSync(sheet.path) } } },
            ],
          },
        ],
        inferenceConfig: { maxTokens: 1500, temperature: 0.2 },
      }),
      { abortSignal: AbortSignal.timeout(options.timeoutMs) },
    );
    const text = (response.output?.message?.content ?? []).map((p) => p.text ?? '').join('');
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = replySchema.safeParse(json ? JSON.parse(json) : {});
    if (!parsed.success) continue;
    const allowed = new Set(sheet.frames.map((f) => f.id));
    for (const e of parsed.data.entities)
      if (!entities.has(e.id)) entities.set(e.id, { aliases: [], ...e });
    for (const f of parsed.data.facts) {
      if (f.evidence.every((ref) => allowed.has(ref)))
        facts.push({ id: `n${facts.length + 1}`, ...f });
    }
  }
  return {
    schemaVersion: 1,
    assetId: options.assetId,
    generator: `bedrock:${options.modelId}`,
    createdAt: new Date().toISOString(),
    method: `one Converse call per contact sheet (${options.sheets.length} sheets)`,
    entities: [...entities.values()],
    facts: facts.sort((a, b) => a.startSec - b.startSec),
  };
}
