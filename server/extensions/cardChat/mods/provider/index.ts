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
 * Request a chat completion from the configured AI provider.
 * Supports both text-only and tool-use completions.
 * When tools are provided, the LLM may return tool_calls instead of
 * a text message.
 */
export async function requestCardChatCompletion({
  messages,
  tools,
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

  const requestBody: Record<string, unknown> = {
    model: config.model,
    messages,
  };

  // [why] Only include tools when provided — the BA persona loop
  // uses text-only completions, while the assist endpoint uses tools.
  if (tools && tools.length > 0) {
    requestBody.tools = tools;
  }

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
      error instanceof Error ? error.message : String(error)
    );
    return {
      status: 502,
      name: 'assist-provider-unreachable',
      message: 'AI provider is unreachable',
    };
  }

  if (!response.ok) {
    const providerMessage = await readFailureMessage(response);
    console.error(
      '[cardChat/provider] Non-OK status:',
      response.status,
      providerMessage ?? '(no body)'
    );

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
      message:
        providerMessage ?? `AI provider request failed with status ${String(response.status)}`,
    };
  }

  let payload: {
    model?: unknown;
    choices?: Array<{
      message?: {
        content?: unknown;
        reasoning?: unknown;
        tool_calls?: Array<{
          id?: unknown;
          type?: unknown;
          function?: { name?: unknown; arguments?: unknown };
        }>;
      };
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

  // [why] Reasoning models (e.g. deepseek-v4-pro) put their response in
  // the `reasoning` field instead of `content`. Check both fields.
  const choiceMessage = payload.choices?.[0]?.message;
  const message =
    typeof choiceMessage?.content === 'string' && choiceMessage.content.trim() !== ''
      ? choiceMessage.content.trim()
      : typeof choiceMessage?.reasoning === 'string' && choiceMessage.reasoning.trim() !== ''
        ? choiceMessage.reasoning.trim()
        : null;

  // [why] Extract tool calls from the response for the assist endpoint.
  const rawToolCalls = choiceMessage?.tool_calls;
  const toolCalls:
    | Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>
    | undefined =
    Array.isArray(rawToolCalls) && rawToolCalls.length > 0
      ? rawToolCalls.filter(
          (
            tc
          ): tc is {
            id: string;
            type: 'function';
            function: { name: string; arguments: string };
          } =>
            typeof tc.id === 'string' &&
            tc.type === 'function' &&
            typeof tc.function?.name === 'string' &&
            typeof tc.function?.arguments === 'string'
        )
      : undefined;

  // [why] Tool calls without a text message are valid — the LLM is
  // responding with actions rather than text.
  if (!message && !toolCalls) {
    return {
      status: 502,
      name: 'assist-provider-response-invalid',
      message: 'AI provider response does not contain a completion message or tool calls',
    };
  }

  const model =
    typeof payload.model === 'string' && payload.model.trim() !== '' ? payload.model : config.model;

  return {
    status: 200,
    data: {
      model,
      message: message ?? '',
      ...(toolCalls ? { toolCalls } : {}),
    },
  };
}
