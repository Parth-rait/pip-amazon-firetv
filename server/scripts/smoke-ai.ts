// npm run smoke:ai: one real model call through the server's model wrapper (Nova, or the local
// model when AI_PROVIDER=ollama); prints the reply and latency.
import 'dotenv/config';
import { loadConfig } from '../src/config.js';
import { createBedrockModel, createOllamaModel } from '../src/core/ai/model.js';

const config = loadConfig();
const local = config.AI_PROVIDER === 'ollama';
const model = local
  ? createOllamaModel({ url: config.OLLAMA_URL, model: config.OLLAMA_MODEL })
  : createBedrockModel({
      region: config.AWS_REGION,
      profile: config.AWS_PROFILE,
      modelId: config.BEDROCK_MODEL_ID,
    });
const where = local
  ? `local model ${config.OLLAMA_MODEL}`
  : `model ${config.BEDROCK_MODEL_ID}, region ${config.AWS_REGION}`;

const startedAt = performance.now();
try {
  const reply = await model.complete({
    system: 'Reply in at most 8 words.',
    user: 'Say hello to a family watching a film.',
    maxTokens: 200,
    temperature: 0.2,
    timeoutMs: 6000,
  });
  const ms = Math.round(performance.now() - startedAt);
  console.log(`reply: ${reply}`);
  console.log(`latency: ${ms} ms (${where})`);
} catch (error) {
  const name = error instanceof Error ? error.name : 'Error';
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${name}: ${message}`);
  process.exit(1);
}
