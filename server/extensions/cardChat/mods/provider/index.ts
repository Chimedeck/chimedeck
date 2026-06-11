// Card-chat AI provider — reuses the board-chat assist provider config
// to call OpenAI-compatible LLMs for the BA persona refinement loop.
import { getAssistProviderConfig } from '../../../board/mods/chat/providerConfig';
import type { CardChatProviderInput, CardChatProviderOutput } from '../../types';

// [why] Reasoning models can take 60-90s for thorough requirement analysis.
const PROVIDER_TIMEOUT_MS = 120_000;

export const cardChatProviderDeps = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  getConfig: getAssistProviderConfig,
  timeoutMs: PROVIDER_TIMEOUT_MS,
};

function buildCompletionsUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL('chat/completions', normalizedBaseUrl).toString();
}

async function readFailureMessage(response: Response): Promise<string | null> {
  const textResponse = response.clone();
  try {
    const payload = (await response.json()) as {
      error?: { message?: unknown };
      message?: unknown;
    };
    if (typeof payload.error?.message === 'string' && payload.error.message.trim() !== '') {
      return payload.error.message.trim();
    }
    if (typeof payload.message === 'string' && payload.message.trim() !== '') {
      return payload.message.trim();
    }
  } catch {
    // Fallback to plaintext.
  }
  const fallbackText = (await textResponse.text()).trim();
  return fallbackText === '' ? null : fallbackText;
}

/**
 * Request a text-only chat completion from the configured AI provider.
 * This is intentionally simpler than the board-chat assist provider
 * because the BA persona loop does not use tool calls — it is a pure
 * conversational refinement loop.
 */
export async function requestCardChatCompletion({
  messages,
}: CardChatProviderInput): Promise<CardChatProviderOutput> {
  let config: { model: string; baseUrl: string; apiKey: string };
  try {
    config = cardChatProviderDeps.getConfig();
  } catch {
    return {
      status: 500,
      name: 'assist-provider-not-configured',
      message: 'AI provider configuration is missing',
    };
  }

  const requestBody = {
    model: config.model,
    messages,
  };

  let response: Response;
  try {
    response = await cardChatProviderDeps.fetch(buildCompletionsUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(cardChatProviderDeps.timeoutMs),
    });
  } catch (error) {
    console.error(
      '[cardChat/provider] Fetch failed:',
      error instanceof Error ? error.message : String(error),
    );
    return {
      status: 502,
      name: 'assist-provider-unreachable',
      message: 'AI provider is unreachable',
    };
  }

  if (!response.ok) {
    const providerMessage = await readFailureMessage(response);
    console.error('[cardChat/provider] Non-OK status:', response.status, providerMessage ?? '(no body)');

    if (response.status === 429) {
      return {
        status: 429,
        name: 'assist-rate-limited',
        message: providerMessage ?? 'AI provider rate limit exceeded',
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        status: 502,
        name: 'assist-provider-auth-failed',
        message: providerMessage ?? 'AI provider rejected authentication',
      };
    }

    return {
      status: 502,
      name: 'assist-provider-request-failed',
      message: providerMessage ?? `AI provider request failed with status ${String(response.status)}`,
    };
  }

  let payload: {
    model?: unknown;
    choices?: Array<{
      message?: { content?: unknown };
    }>;
  };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return {
      status: 502,
      name: 'assist-provider-response-invalid',
      message: 'AI provider returned an invalid response',
    };
  }

  const message = payload.choices?.[0]?.message?.content;
  if (typeof message !== 'string' || message.trim() === '') {
    return {
      status: 502,
      name: 'assist-provider-response-invalid',
      message: 'AI provider response does not contain a completion message',
    };
  }

  const model = typeof payload.model === 'string' && payload.model.trim() !== ''
    ? payload.model
    : config.model;

  return {
    status: 200,
    data: {
      model,
      message: message.trim(),
    },
  };
}
