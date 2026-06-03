import { beforeEach, describe, expect, it } from 'bun:test';
import type { BoardChatAssistProviderConfig } from '../../../../types';

let config: BoardChatAssistProviderConfig | null;
let fetchCalls: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }>;
let fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const providerModule = await import('../provider');
const { requestBoardChatAssistCompletion, boardChatAssistProviderDeps } = providerModule;

beforeEach(() => {
  config = {
    apiKey: 'test-key',
    baseUrl: 'https://example.openai.local/v1',
    model: 'gpt-4.1-mini',
  };
  fetchCalls = [];
  fetchImpl = (input, init) => {
    fetchCalls.push({ input, init });
    return Promise.resolve(Response.json({
      id: 'resp-1',
      model: 'gpt-4.1-mini',
      choices: [{ message: { content: 'Use the payment checklist first.' } }],
      usage: { prompt_tokens: 20, completion_tokens: 7, total_tokens: 27 },
    }));
  };

  boardChatAssistProviderDeps.getConfig = () => {
    if (!config) throw new Error('assist-provider-not-configured');
    return config;
  };
  boardChatAssistProviderDeps.fetch = (input, init) => fetchImpl(input, init);
});

describe('requestBoardChatAssistCompletion', () => {
  it('sends OpenAI-compatible chat completions requests', async () => {
    const result = await requestBoardChatAssistCompletion({
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'What should we do next?' },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'create_board_card',
            description: 'Create a new card on the current board.',
            parameters: {
              type: 'object',
              properties: {},
              required: ['title', 'listId'],
              additionalProperties: false,
            },
          },
        },
      ],
    });

    expect(result.status).toBe(200);
    expect(result.data?.message).toBe('Use the payment checklist first.');
    expect(fetchCalls).toHaveLength(1);

    const call = fetchCalls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('missing-fetch-call');
    expect(call.input).toBe('https://example.openai.local/v1/chat/completions');
    expect(call.init?.method).toBe('POST');
    const headers = call.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-key');

    const rawBody = call.init?.body;
    expect(typeof rawBody).toBe('string');
    if (typeof rawBody !== 'string') throw new Error('missing-request-body');
    const payload = JSON.parse(rawBody) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      tools?: unknown[];
      tool_choice?: string;
    };
    expect(payload.model).toBe('gpt-4.1-mini');
    expect(payload.messages).toHaveLength(2);
    expect(payload.tools).toHaveLength(1);
    expect(payload.tool_choice).toBe('auto');
  });

  it('normalizes tool-call responses', async () => {
    fetchImpl = (input, init) => {
      fetchCalls.push({ input, init });
      return Promise.resolve(Response.json({
        id: 'resp-1',
        model: 'gpt-4.1-mini',
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'call-1',
              type: 'function',
              function: {
                name: 'create_board_card',
                arguments: '{"title":"Plan launch","listId":"list-1"}',
              },
            }],
          },
        }],
        usage: { prompt_tokens: 20, completion_tokens: 7, total_tokens: 27 },
      }));
    };

    const result = await requestBoardChatAssistCompletion({
      messages: [{ role: 'user', content: 'Create a launch card' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'create_board_card',
            description: 'Create a new card on the current board.',
            parameters: {
              type: 'object',
              properties: {},
              required: ['title', 'listId'],
              additionalProperties: false,
            },
          },
        },
      ],
    });

    expect(result.status).toBe(200);
    expect(result.data?.toolCalls).toEqual([
      {
        id: 'call-1',
        type: 'function',
        function: {
          name: 'create_board_card',
          arguments: '{"title":"Plan launch","listId":"list-1"}',
        },
      },
    ]);
  });

  it('returns config errors when provider settings are missing', async () => {
    config = null;

    const result = await requestBoardChatAssistCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(500);
    expect(result.name).toBe('assist-provider-not-configured');
    expect(fetchCalls).toHaveLength(0);
  });

  it('maps rate limit responses', async () => {
    fetchImpl = (input, init) => {
      fetchCalls.push({ input, init });
      return Promise.resolve(Response.json(
        { error: { message: 'Rate limit hit' } },
        { status: 429 },
      ));
    };

    const result = await requestBoardChatAssistCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(429);
    expect(result.name).toBe('assist-rate-limited');
  });

  it('maps provider authentication failures', async () => {
    fetchImpl = (input, init) => {
      fetchCalls.push({ input, init });
      return Promise.resolve(Response.json(
        { error: { message: 'Invalid API key' } },
        { status: 401 },
      ));
    };

    const result = await requestBoardChatAssistCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(502);
    expect(result.name).toBe('assist-provider-auth-failed');
  });

  it('maps network failures to unreachable errors', async () => {
    fetchImpl = () => Promise.reject(new Error('network-down'));

    const result = await requestBoardChatAssistCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(502);
    expect(result.name).toBe('assist-provider-unreachable');
  });

  it('rejects invalid provider success payloads', async () => {
    fetchImpl = (input, init) => {
      fetchCalls.push({ input, init });
      return Promise.resolve(Response.json({ choices: [] }));
    };

    const result = await requestBoardChatAssistCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(502);
    expect(result.name).toBe('assist-provider-response-invalid');
  });
});
