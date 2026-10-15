// npm run smoke:ai: one real Nova call through the server's model wrapper; prints the reply and latency.
import 'dotenv/config';
import { loadConfig } from '../src/config.js';
import { createBedrockModel } from '../src/core/ai/model.js';

const config = loadConfig();
const model = createBedrockModel({
  region: config.AWS_REGION,
  profile: config.AWS_PROFILE,
  modelId: config.BEDROCK_MODEL_ID,
});

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
  console.log(`latency: ${ms} ms (model ${config.BEDROCK_MODEL_ID}, region ${config.AWS_REGION})`);
} catch (error) {
  const name = error instanceof Error ? error.name : 'Error';
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${name}: ${message}`);
  process.exit(1);
}
