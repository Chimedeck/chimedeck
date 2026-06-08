import { beforeEach, describe, expect, it, mock } from 'bun:test';

// Mutable per-test env state. The mock module below exposes this through
// getters so the resolver under test reads the latest values on every call.
const envState: Record<string, string> = {
  CHAT_PROVIDER: 'ollama',
  CHAT_EMBEDDING_API_URL: '',
  CHAT_EMBEDDING_API_KEY: '',
  CHAT_EMBEDDING_MODEL: 'text-embedding-3-small',
  CHAT_EMBEDDING_DIMENSIONS: '1536',
  CHAT_ASSIST_API_KEY: '',
  CHAT_ASSIST_BASE_URL: '',
  CHAT_ASSIST_MODEL: '',
  OLLAMA_API_KEY: '',
  OLLAMA_BASE_URL: 'https://ollama.com/v1',
  OLLAMA_EMBEDDING_MODEL: '',
  OLLAMA_EMBEDDING_DIMENSIONS: '1024',
  OLLAMA_ASSIST_MODEL: 'deepseek-r1',
  // [why] Default to 'true' in the mock so existing tests keep working —
  // production behaviour matches (CHAT_EMBEDDING_ENABLED defaults to true in
  // server/config/env.ts). Tests that exercise the disabled path set it to
  // 'false' explicitly.
  CHAT_EMBEDDING_ENABLED: 'true',
};

function setEnv(updates: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      delete envState[key];
    } else {
      envState[key] = value;
    }
  }
}

mock.module('../../../../../config/env', () => ({
  env: {
    get CHAT_PROVIDER() {
      const raw = envState.CHAT_PROVIDER ?? 'ollama';
      return raw.toLowerCase() === 'openai' ? 'openai' : 'ollama';
    },
    get CHAT_EMBEDDING_ENABLED() {
      // Production default is true; only 'false' (exact) flips it off.
      return (envState.CHAT_EMBEDDING_ENABLED ?? 'true') !== 'false';
    },
    get CHAT_EMBEDDING_API_URL() { return envState.CHAT_EMBEDDING_API_URL ?? ''; },
    get CHAT_EMBEDDING_API_KEY() { return envState.CHAT_EMBEDDING_API_KEY ?? ''; },
    get CHAT_EMBEDDING_MODEL() { return envState.CHAT_EMBEDDING_MODEL ?? 'text-embedding-3-small'; },
    get CHAT_EMBEDDING_DIMENSIONS() { return Number.parseInt(envState.CHAT_EMBEDDING_DIMENSIONS ?? '1536', 10); },
    get CHAT_ASSIST_API_KEY() { return envState.CHAT_ASSIST_API_KEY ?? ''; },
    get CHAT_ASSIST_BASE_URL() { return envState.CHAT_ASSIST_BASE_URL ?? ''; },
    get CHAT_ASSIST_MODEL() { return envState.CHAT_ASSIST_MODEL ?? ''; },
    get OLLAMA_API_KEY() { return envState.OLLAMA_API_KEY ?? ''; },
    get OLLAMA_BASE_URL() { return envState.OLLAMA_BASE_URL ?? 'https://ollama.com/v1'; },
    get OLLAMA_EMBEDDING_MODEL() { return envState.OLLAMA_EMBEDDING_MODEL ?? ''; },
    get OLLAMA_EMBEDDING_DIMENSIONS() { return Number.parseInt(envState.OLLAMA_EMBEDDING_DIMENSIONS ?? '1024', 10); },
    get OLLAMA_ASSIST_MODEL() { return envState.OLLAMA_ASSIST_MODEL ?? ''; },
  },
}));

const { getEmbeddingProviderConfig, getAssistProviderConfig } = await import('../providerConfig');

beforeEach(() => {
  setEnv({
    CHAT_PROVIDER: 'openai',
    CHAT_EMBEDDING_ENABLED: 'true',
    CHAT_EMBEDDING_API_URL: '',
    CHAT_EMBEDDING_API_KEY: '',
    CHAT_EMBEDDING_MODEL: 'text-embedding-3-small',
    CHAT_EMBEDDING_DIMENSIONS: '1536',
    CHAT_ASSIST_API_KEY: '',
    CHAT_ASSIST_BASE_URL: '',
    CHAT_ASSIST_MODEL: '',
    OLLAMA_API_KEY: '',
    OLLAMA_BASE_URL: 'https://ollama.com/v1',
    OLLAMA_EMBEDDING_MODEL: '',
    OLLAMA_EMBEDDING_DIMENSIONS: '1024',
    OLLAMA_ASSIST_MODEL: 'deepseek-r1',
  });
});

describe('getEmbeddingProviderConfig', () => {
  it('returns openai config by default', () => {
    setEnv({
      CHAT_PROVIDER: 'openai',
      CHAT_EMBEDDING_API_URL: 'https://api.openai.com/v1/embeddings',
      CHAT_EMBEDDING_API_KEY: 'sk-test',
      CHAT_EMBEDDING_MODEL: 'text-embedding-3-large',
      CHAT_EMBEDDING_DIMENSIONS: '3072',
    });

    const config = getEmbeddingProviderConfig();
    expect(config.provider).toBe('openai');
    expect(config.apiUrl).toBe('https://api.openai.com/v1/embeddings');
    expect(config.apiKey).toBe('sk-test');
    expect(config.model).toBe('text-embedding-3-large');
    expect(config.defaultDimensions).toBe(3072);
  });

  it('treats unknown CHAT_PROVIDER values as ollama (the default)', () => {
    setEnv({
      CHAT_PROVIDER: 'banana',
      OLLAMA_BASE_URL: 'https://ollama.com/v1',
      OLLAMA_EMBEDDING_MODEL: 'mxbai-embed-large',
      OLLAMA_EMBEDDING_DIMENSIONS: '1024',
    });

    const config = getEmbeddingProviderConfig();
    expect(config.provider).toBe('ollama');
    expect(config.apiUrl).toMatch(/\/embeddings$/);
  });

  it('throws when the openai embedding URL is missing', () => {
    setEnv({
      CHAT_PROVIDER: 'openai',
      CHAT_EMBEDDING_API_URL: '',
      CHAT_EMBEDDING_MODEL: 'text-embedding-3-small',
    });

    expect(() => getEmbeddingProviderConfig()).toThrow('chat-embedding-provider-not-configured');
  });

  it('throws when the openai embedding model is missing', () => {
    setEnv({
      CHAT_PROVIDER: 'openai',
      CHAT_EMBEDDING_API_URL: 'https://api.openai.com/v1/embeddings',
      CHAT_EMBEDDING_MODEL: '',
    });

    expect(() => getEmbeddingProviderConfig()).toThrow('chat-embedding-provider-not-configured');
  });

  it('returns ollama config when CHAT_PROVIDER=ollama', () => {
    setEnv({
      CHAT_PROVIDER: 'ollama',
      OLLAMA_API_KEY: 'oll-key',
      OLLAMA_BASE_URL: 'https://ollama.com/v1',
      OLLAMA_EMBEDDING_MODEL: 'nomic-embed-text',
      OLLAMA_EMBEDDING_DIMENSIONS: '768',
    });

    const config = getEmbeddingProviderConfig();
    expect(config.provider).toBe('ollama');
    expect(config.apiUrl).toBe('https://ollama.com/v1/embeddings');
    expect(config.apiKey).toBe('oll-key');
    expect(config.model).toBe('nomic-embed-text');
    expect(config.defaultDimensions).toBe(768);
  });

  it('normalises the ollama base url with and without a trailing slash', () => {
    setEnv({
      CHAT_PROVIDER: 'ollama',
      OLLAMA_BASE_URL: 'https://ollama.com/v1/',
      OLLAMA_EMBEDDING_MODEL: 'nomic-embed-text',
    });

    expect(getEmbeddingProviderConfig().apiUrl).toBe('https://ollama.com/v1/embeddings');

    setEnv({ OLLAMA_BASE_URL: 'https://ollama.com/v1' });
    expect(getEmbeddingProviderConfig().apiUrl).toBe('https://ollama.com/v1/embeddings');
  });

  it('throws when ollama base url is missing', () => {
    setEnv({
      CHAT_PROVIDER: 'ollama',
      OLLAMA_BASE_URL: '',
      OLLAMA_EMBEDDING_MODEL: 'nomic-embed-text',
    });

    expect(() => getEmbeddingProviderConfig()).toThrow('chat-embedding-provider-not-configured');
  });

  it('throws when ollama embedding model is missing', () => {
    setEnv({
      CHAT_PROVIDER: 'ollama',
      OLLAMA_BASE_URL: 'https://ollama.com/v1',
      OLLAMA_EMBEDDING_MODEL: '',
    });

    expect(() => getEmbeddingProviderConfig()).toThrow('chat-embedding-provider-not-configured');
  });

  it('throws the feature-disabled error when CHAT_EMBEDDING_ENABLED=false (openai branch)', () => {
    setEnv({
      CHAT_EMBEDDING_ENABLED: 'false',
      CHAT_PROVIDER: 'openai',
      // Even with all values present, the gate should fire first.
      CHAT_EMBEDDING_API_URL: 'https://api.openai.com/v1/embeddings',
      CHAT_EMBEDDING_API_KEY: 'sk-test',
      CHAT_EMBEDDING_MODEL: 'text-embedding-3-small',
    });

    expect(() => getEmbeddingProviderConfig()).toThrow('chat-embedding-feature-disabled');
  });

  it('throws the feature-disabled error when CHAT_EMBEDDING_ENABLED=false (ollama branch)', () => {
    setEnv({
      CHAT_EMBEDDING_ENABLED: 'false',
      CHAT_PROVIDER: 'ollama',
      // Ollama Cloud currently has no embedding model — the operator flips
      // this flag off rather than getting spammed with provider-not-configured.
      OLLAMA_BASE_URL: 'https://ollama.com/v1',
      OLLAMA_EMBEDDING_MODEL: '',
      OLLAMA_API_KEY: 'oll-key',
    });

    expect(() => getEmbeddingProviderConfig()).toThrow('chat-embedding-feature-disabled');
  });

  it('treats anything other than "false" as enabled (matching env.ts semantics)', () => {
    setEnv({
      CHAT_EMBEDDING_ENABLED: '0',
      CHAT_PROVIDER: 'openai',
      CHAT_EMBEDDING_API_URL: 'https://api.openai.com/v1/embeddings',
      CHAT_EMBEDDING_MODEL: 'text-embedding-3-small',
    });

    const config = getEmbeddingProviderConfig();
    expect(config.provider).toBe('openai');
  });
});

describe('getAssistProviderConfig', () => {
  it('returns openai config by default', () => {
    setEnv({
      CHAT_PROVIDER: 'openai',
      CHAT_ASSIST_API_KEY: 'sk-test',
      CHAT_ASSIST_BASE_URL: 'https://api.openai.com/v1',
      CHAT_ASSIST_MODEL: 'gpt-4.1-mini',
    });

    const config = getAssistProviderConfig();
    expect(config.provider).toBe('openai');
    expect(config.baseUrl).toBe('https://api.openai.com/v1');
    expect(config.apiKey).toBe('sk-test');
    expect(config.model).toBe('gpt-4.1-mini');
  });

  it('throws when any openai assist value is missing', () => {
    setEnv({
      CHAT_PROVIDER: 'openai',
      CHAT_ASSIST_API_KEY: '',
      CHAT_ASSIST_BASE_URL: 'https://api.openai.com/v1',
      CHAT_ASSIST_MODEL: 'gpt-4.1-mini',
    });
    expect(() => getAssistProviderConfig()).toThrow('assist-provider-not-configured');

    setEnv({ CHAT_ASSIST_API_KEY: 'sk-test', CHAT_ASSIST_BASE_URL: '', CHAT_ASSIST_MODEL: 'm' });
    expect(() => getAssistProviderConfig()).toThrow('assist-provider-not-configured');

    setEnv({ CHAT_ASSIST_BASE_URL: 'https://x', CHAT_ASSIST_MODEL: '' });
    expect(() => getAssistProviderConfig()).toThrow('assist-provider-not-configured');
  });

  it('returns ollama config when CHAT_PROVIDER=ollama', () => {
    setEnv({
      CHAT_PROVIDER: 'ollama',
      OLLAMA_API_KEY: 'oll-key',
      OLLAMA_BASE_URL: 'https://ollama.com/v1',
      OLLAMA_ASSIST_MODEL: 'llama3.1',
    });

    const config = getAssistProviderConfig();
    expect(config.provider).toBe('ollama');
    expect(config.baseUrl).toBe('https://ollama.com/v1');
    expect(config.apiKey).toBe('oll-key');
    expect(config.model).toBe('llama3.1');
  });

  it('throws when any ollama assist value is missing', () => {
    setEnv({
      CHAT_PROVIDER: 'ollama',
      OLLAMA_API_KEY: '',
      OLLAMA_BASE_URL: 'https://ollama.com/v1',
      OLLAMA_ASSIST_MODEL: 'llama3.1',
    });
    expect(() => getAssistProviderConfig()).toThrow('assist-provider-not-configured');

    setEnv({ OLLAMA_API_KEY: 'k', OLLAMA_BASE_URL: '', OLLAMA_ASSIST_MODEL: 'llama3.1' });
    expect(() => getAssistProviderConfig()).toThrow('assist-provider-not-configured');

    setEnv({ OLLAMA_BASE_URL: 'https://ollama.com/v1', OLLAMA_ASSIST_MODEL: '' });
    expect(() => getAssistProviderConfig()).toThrow('assist-provider-not-configured');
  });

  it('ignores CHAT_ASSIST_* values when CHAT_PROVIDER=ollama', () => {
    setEnv({
      CHAT_PROVIDER: 'ollama',
      // OpenAI vars are populated but should NOT be read.
      CHAT_ASSIST_API_KEY: 'sk-openai',
      CHAT_ASSIST_BASE_URL: 'https://api.openai.com/v1',
      CHAT_ASSIST_MODEL: 'gpt-4.1-mini',
      // Ollama vars are the only ones consumed.
      OLLAMA_API_KEY: 'oll-key',
      OLLAMA_BASE_URL: 'https://ollama.com/v1',
      OLLAMA_ASSIST_MODEL: 'llama3.1',
    });

    const config = getAssistProviderConfig();
    expect(config.provider).toBe('ollama');
    expect(config.apiKey).toBe('oll-key');
    expect(config.model).toBe('llama3.1');
  });
});
