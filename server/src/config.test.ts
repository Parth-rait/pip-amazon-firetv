import { describe, expect, it } from 'vitest';
import { parseConfig } from './config.js';

describe('parseConfig', () => {
  it('applies the defaults from section 7.4 when nothing is set', () => {
    expect(parseConfig({})).toEqual({
      PORT: 8787,
      PUBLIC_URL: 'http://localhost:8787',
      AWS_PROFILE: 'pip',
      AWS_REGION: 'us-east-1',
      BEDROCK_MODEL_ID: 'us.amazon.nova-2-lite-v1:0',
      AI_ENABLED: true,
      AI_PROVIDER: 'bedrock',
      OLLAMA_URL: 'http://localhost:11434',
      OLLAMA_MODEL: 'qwen2.5:3b',
      ANSWER_MEMORY: true,
      LOG_TEXT: false,
    });
  });

  it('reads the flags and strips a trailing slash from PUBLIC_URL', () => {
    const config = parseConfig({
      AI_ENABLED: 'false',
      LOG_TEXT: 'true',
      PUBLIC_URL: 'https://pip.trycloudflare.com/',
    });
    expect(config.AI_ENABLED).toBe(false);
    expect(config.LOG_TEXT).toBe(true);
    expect(config.PUBLIC_URL).toBe('https://pip.trycloudflare.com');
  });

  it('rejects an invalid PORT', () => {
    expect(() => parseConfig({ PORT: 'eighty' })).toThrow(/PORT/);
    expect(() => parseConfig({ PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejects a flag that is not true or false', () => {
    expect(() => parseConfig({ AI_ENABLED: 'yes' })).toThrow(/AI_ENABLED/);
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(parseConfig({}))).toBe(true);
  });
});
