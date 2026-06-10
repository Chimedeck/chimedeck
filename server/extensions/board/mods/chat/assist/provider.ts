import { getAssistProviderConfig } from '../providerConfig';
import type {
  BoardChatAssistOutput,
  BoardChatAssistProviderConfig,
  BoardChatAssistProviderInput,
  BoardChatAssistToolCall,
} from '../../../types';

// [why] Reasoning models (e.g. deepseek-v4-pro) can take 30-90s to generate a
// full response. 15s was too aggressive and caused the provider fetch to abort,
// which was then surfaced as "unreachable" rather than a timeout.
const ASSIST_PROVIDER_TIMEOUT_MS = 120_000;

interface ChatCompletionResponse {
  model?: unknown;
  choices?: Array<{
    message?: {
      content?: unknown;
      tool_calls?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  };
}

function getRequiredAssistConfig() {
  // [why] Provider resolution (OpenAI vs Ollama) is centralised in providerConfig
  // so the assist call site stays provider-agnostic.
  return getAssistProviderConfig();
}

function buildCompletionsUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL('chat/completions', normalizedBaseUrl).toString();
}

async function readProviderFailureMessage(response: Response): Promise<string | null> {
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
    // Fallback to plaintext body when provider does not return JSON.
  }

  const fallbackText = (await textResponse.text()).trim();
  return fallbackText === '' ? null : fallbackText;
}

function normalizeUsage(usage: ChatCompletionResponse['usage']) {
  if (!usage) return undefined;
  const promptTokens = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : undefined;
  const completionTokens = typeof usage.completion_tokens === 'number' ? usage.completion_tokens : undefined;
  const totalTokens = typeof usage.total_tokens === 'number' ? usage.total_tokens : undefined;
  if (
    typeof promptTokens === 'undefined'
    && typeof completionTokens === 'undefined'
    && typeof totalTokens === 'undefined'
  ) {
    return undefined;
  }
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
  };
}

function normalizeToolCalls(toolCalls: unknown): BoardChatAssistToolCall[] | undefined {
  if (!Array.isArray(toolCalls)) return undefined;

  const normalized = toolCalls
    .map((toolCall) => {
      if (!toolCall || typeof toolCall !== 'object') return null;
      const candidate = toolCall as {
        id?: unknown;
        type?: unknown;
        function?: {
          name?: unknown;
          arguments?: unknown;
        };
      };

      if (typeof candidate.id !== 'string' || candidate.id.trim() === '') return null;
      if (candidate.type !== 'function') return null;
      if (typeof candidate.function?.name !== 'string' || candidate.function.name.trim() === '') return null;
      if (typeof candidate.function.arguments !== 'string') return null;

      return {
        id: candidate.id,
        type: 'function' as const,
        function: {
          name: candidate.function.name,
          arguments: candidate.function.arguments,
        },
      };
    })
    .filter((toolCall): toolCall is BoardChatAssistToolCall => toolCall !== null);

  return normalized.length > 0 ? normalized : undefined;
}

export const boardChatAssistProviderDeps = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  getConfig: getRequiredAssistConfig,
  timeoutMs: ASSIST_PROVIDER_TIMEOUT_MS,
};

export async function requestBoardChatAssistCompletion({
  messages,
  tools,
}: BoardChatAssistProviderInput): Promise<BoardChatAssistOutput> {
  let config: BoardChatAssistProviderConfig;
  try {
    config = boardChatAssistProviderDeps.getConfig();
  } catch {
    return {
      status: 500,
      name: 'assist-provider-not-configured',
      message: 'Assist provider configuration is missing',
    };
  }

  const requestBody = {
    model: config.model,
    messages,
    ...(tools && tools.length > 0
      ? {
        tools,
        tool_choice: 'auto',
      }
      : {}),
  };

  let response: Response;
  try {
    response = await boardChatAssistProviderDeps.fetch(buildCompletionsUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(boardChatAssistProviderDeps.timeoutMs),
    });
  } catch (error) {
    console.error('[chat/assist] Provider fetch failed (network error or timeout):', error instanceof Error ? error.message : String(error));
    return {
      status: 502,
      name: 'assist-provider-unreachable',
      message: 'Assist provider is unreachable',
    };
  }

  if (!response.ok) {
    const providerMessage = await readProviderFailureMessage(response);
  console.error('[chat/assist] Provider returned non-OK status:', response.status, providerMessage ?? '(no body)');

  if (response.status === 429) {
      return {
        status: 429,
        name: 'assist-rate-limited',
        message: providerMessage ?? 'Assist provider rate limit exceeded',
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        status: 502,
        name: 'assist-provider-auth-failed',
        message: providerMessage ?? 'Assist provider rejected authentication',
      };
    }

    return {
      status: 502,
      name: 'assist-provider-request-failed',
      message: providerMessage ?? `Assist provider request failed with status ${String(response.status)}`,
    };
  }

  let payload: ChatCompletionResponse;
  try {
    payload = (await response.json()) as ChatCompletionResponse;
  } catch {
    return {
      status: 502,
      name: 'assist-provider-response-invalid',
      message: 'Assist provider returned an invalid response',
    };
  }

  const message = payload.choices?.[0]?.message?.content;
  const toolCalls = normalizeToolCalls(payload.choices?.[0]?.message?.tool_calls);
  if ((typeof message !== 'string' || message.trim() === '') && !toolCalls) {
    return {
      status: 502,
      name: 'assist-provider-response-invalid',
      message: 'Assist provider response does not contain a completion message or tool call',
    };
  }

  const model = typeof payload.model === 'string' && payload.model.trim() !== ''
    ? payload.model
    : config.model;
  const usage = normalizeUsage(payload.usage);
  const data: {
    model: string;
    message?: string;
    toolCalls?: BoardChatAssistToolCall[];
    usage?: NonNullable<BoardChatAssistOutput['data']>['usage'];
  } = { model };
  if (typeof message === 'string' && message.trim() !== '') {
    data.message = message.trim();
  }
  if (toolCalls) {
    data.toolCalls = toolCalls;
  }
  if (usage) {
    data.usage = usage;
  }
  return {
    status: 200,
    data,
  };
}
