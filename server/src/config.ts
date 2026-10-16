// Server configuration: parses the environment (PROJECT.md section 7.4) once at startup.
import { z } from 'zod';

const booleanFlag = z.enum(['true', 'false']).transform((value) => value === 'true');

export const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  PUBLIC_URL: z
    .url({ protocol: /^https?$/ })
    .transform((url) => url.replace(/\/+$/, ''))
    .default('http://localhost:8787'),
  AWS_PROFILE: z.string().min(1).default('pip'),
  AWS_REGION: z.string().min(1).default('us-east-1'),
  BEDROCK_MODEL_ID: z.string().min(1).default('us.amazon.nova-2-lite-v1:0'),
  AI_ENABLED: booleanFlag.default(true),
  AI_PROVIDER: z.enum(['bedrock', 'ollama']).default('bedrock'),
  OLLAMA_URL: z.url({ protocol: /^https?$/ }).default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().min(1).default('qwen2.5:3b'),
  ANSWER_MEMORY: booleanFlag.default(true),
  LOG_TEXT: booleanFlag.default(false),
});

export type Config = Readonly<z.infer<typeof configSchema>>;

/** Parses an environment object; throws a readable error listing every bad variable. */
export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid server/.env: ${problems.join('; ')}`);
  }
  return Object.freeze(result.data);
}

/** Loads the config from process.env, or prints one clear message and exits. */
export function loadConfig(): Config {
  try {
    return parseConfig(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
