// Chat provider config resolver — single source of truth that decides which
// HTTP endpoint, API key, and model the board-chat embedding + assist paths
// should hit based on the CHAT_PROVIDER env var.
//
// Supported providers:
//   - "openai"  (default) → uses CHAT_EMBEDDING_* and CHAT_ASSIST_* env vars
//     to point at any OpenAI-compatible endpoint (api.openai.com by default).
//   - "ollama"            → routes through https://ollama.com/v1 using the
//     OLLAMA_* env vars (api key, base url, embedding model + dimensions,
//     assist model). All four values are required to enable the assist flow.
//
// Both providers speak the OpenAI HTTP schema, so the call sites in
// `assist/provider.ts` and `messages/embedding.ts` are provider-agnostic.
//
// The embedding path is independently gated by CHAT_EMBEDDING_ENABLED. Set it
// to false when the active provider has no embedding model (e.g. Ollama Cloud
// currently exposes chat models but no /v1/embeddings endpoint) or to disable
// semantic retrieval without turning off chat. When disabled, the resolver
// throws 'chat-embedding-feature-disabled' so the call site can show a clear
// UI message instead of a generic configuration error.
import { env } from '../../../../config/env';

export type ChatProvider = 'openai' | 'ollama';

export interface EmbeddingProviderConfig {
  provider: ChatProvider;
  apiUrl: string;
  apiKey: string;
  model: string;
  // [context] Optional default for the response vector length. Falls back to
  // whatever the API actually returns. Useful for Ollama where the dimension
  // depends on the chosen model (e.g. nomic-embed-text → 768, mxbai-embed-large → 1024).
  defaultDimensions: number;
}

export interface AssistProviderConfig {
  provider: ChatProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Resolve the embedding provider configuration. Throws when required values
 * (apiUrl, model) are missing so callers can fail fast with a domain-specific
 * error name.
 *
 * Throws 'chat-embedding-feature-disabled' when CHAT_EMBEDDING_ENABLED=false —
 * callers should surface this to the user as a feature toggle rather than a
 * configuration error.
 */
export function getEmbeddingProviderConfig(): EmbeddingProviderConfig {
  // [why] Gate runs before any provider branch so a deployment that never
  // intends to use embeddings (e.g. Ollama Cloud) doesn't surface a confusing
  // "not configured" error on every chat write that touches the vector path.
  if (!env.CHAT_EMBEDDING_ENABLED) {
    throw new Error('chat-embedding-feature-disabled');
  }

  if (env.CHAT_PROVIDER === 'ollama') {
    if (!env.OLLAMA_BASE_URL || !env.OLLAMA_EMBEDDING_MODEL) {
      throw new Error('chat-embedding-provider-not-configured');
    }
    return {
      provider: 'ollama',
      apiUrl: buildOllamaEmbeddingsUrl(env.OLLAMA_BASE_URL),
      apiKey: env.OLLAMA_API_KEY,
      model: env.OLLAMA_EMBEDDING_MODEL,
      defaultDimensions: env.OLLAMA_EMBEDDING_DIMENSIONS,
    };
  }

  if (!env.CHAT_EMBEDDING_API_URL || !env.CHAT_EMBEDDING_MODEL) {
    throw new Error('chat-embedding-provider-not-configured');
  }
  return {
    provider: 'openai',
    apiUrl: env.CHAT_EMBEDDING_API_URL,
    apiKey: env.CHAT_EMBEDDING_API_KEY,
    model: env.CHAT_EMBEDDING_MODEL,
    defaultDimensions: env.CHAT_EMBEDDING_DIMENSIONS,
  };
}

/**
 * Resolve the assist provider configuration. Throws when any of apiKey, baseUrl,
 * or model are missing — Ollama always requires all three.
 */
export function getAssistProviderConfig(): AssistProviderConfig {
  if (env.CHAT_PROVIDER === 'ollama') {
    if (!env.OLLAMA_API_KEY || !env.OLLAMA_BASE_URL || !env.OLLAMA_ASSIST_MODEL) {
      throw new Error('assist-provider-not-configured');
    }
    return {
      provider: 'ollama',
      baseUrl: env.OLLAMA_BASE_URL,
      apiKey: env.OLLAMA_API_KEY,
      model: env.OLLAMA_ASSIST_MODEL,
    };
  }

  if (!env.CHAT_ASSIST_API_KEY || !env.CHAT_ASSIST_BASE_URL || !env.CHAT_ASSIST_MODEL) {
    throw new Error('assist-provider-not-configured');
  }
  return {
    provider: 'openai',
    baseUrl: env.CHAT_ASSIST_BASE_URL,
    apiKey: env.CHAT_ASSIST_API_KEY,
    model: env.CHAT_ASSIST_MODEL,
  };
}

/**
 * Ollama's `/v1/embeddings` endpoint mirrors OpenAI's embeddings schema but
 * lives at `<base>/v1/embeddings`. We normalise the trailing slash and
 * append the path so users can supply either `https://ollama.com/v1` or
 * `https://ollama.com/v1/` interchangeably.
 */
function buildOllamaEmbeddingsUrl(baseUrl: string): string {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL('embeddings', normalized).toString();
}
