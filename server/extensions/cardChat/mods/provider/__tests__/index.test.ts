import { beforeEach, describe, expect, it } from 'bun:test';

// [why] Dynamic import so the deps can be overridden per test.
const providerModule = await import('../index');
const { requestCardChatCompletion, cardChatProviderDeps } = providerModule;

let config: { apiKey: string; baseUrl: string; model: string } | null;
let fetchCalls: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }>;
let fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

beforeEach(() => {
  config = {
    apiKey: 'test-key',
    baseUrl: 'https://example.openai.local/v1',
    model: 'gpt-4.1-mini',
  };
  fetchCalls = [];
  fetchImpl = (input, init) => {
    fetchCalls.push({ input, init });
    return Promise.resolve(
      Response.json({
        model: 'gpt-4.1-mini',
        choices: [{ message: { content: 'Here is your refined requirement.' } }],
        usage: { prompt_tokens: 150, completion_tokens: 80, total_tokens: 230 },
      })
    );
  };

  cardChatProviderDeps.getConfig = () => {
    if (!config) throw new Error('assist-provider-not-configured');
    return config;
  };
  cardChatProviderDeps.fetch = (input, init) => fetchImpl(input, init);
});

describe('requestCardChatCompletion', () => {
  it('sends OpenAI-compatible chat completions requests', async () => {
    const result = await requestCardChatCompletion({
      messages: [
        { role: 'system', content: 'You are a BA.' },
        { role: 'user', content: 'Refine this requirement.' },
      ],
    });

    expect(result.status).toBe(200);
    expect(result.data?.message).toBe('Here is your refined requirement.');
    expect(result.data?.model).toBe('gpt-4.1-mini');
    expect(fetchCalls).toHaveLength(1);

    const call = fetchCalls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('missing-fetch-call');
    expect(call.input).toBe('https://example.openai.local/v1/chat/completions');
    expect(call.init?.method).toBe('POST');

    const headers = call.init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Authorization).toBe('Bearer test-key');

    const rawBody = call.init?.body;
    expect(typeof rawBody).toBe('string');
    if (typeof rawBody !== 'string') throw new Error('missing-request-body');
    const payload = JSON.parse(rawBody) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(payload.model).toBe('gpt-4.1-mini');
    expect(payload.messages).toHaveLength(2);
    // [why] cardChat provider is a text-only LLM call — no tools or tool_choice.
  });

  it('normalizes baseUrl without trailing slash', async () => {
    if (!config) throw new Error('config-null');
    config.baseUrl = 'https://example.openai.local/v1/';

    await requestCardChatCompletion({ messages: [{ role: 'user', content: 'Hello' }] });

    expect(fetchCalls[0]?.input).toBe('https://example.openai.local/v1/chat/completions');
  });

  it('returns config error when provider settings are missing', async () => {
    config = null;

    const result = await requestCardChatCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(500);
    expect(result.name).toBe('assist-provider-not-configured');
    expect(fetchCalls).toHaveLength(0);
  });

  it('maps rate limit responses (429)', async () => {
    fetchImpl = (input, init) => {
      fetchCalls.push({ input, init });
      return Promise.resolve(
        Response.json({ error: { message: 'Rate limit hit. Try again in 30s.' } }, { status: 429 })
      );
    };

    const result = await requestCardChatCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(429);
    expect(result.name).toBe('assist-rate-limited');
    expect(result.message).toBe('Rate limit hit. Try again in 30s.');
  });

  it('maps provider authentication failures (401)', async () => {
    fetchImpl = (input, init) => {
      fetchCalls.push({ input, init });
      return Promise.resolve(
        Response.json({ error: { message: 'Invalid API key' } }, { status: 401 })
      );
    };

    const result = await requestCardChatCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(502);
    expect(result.name).toBe('assist-provider-auth-failed');
  });

  it('maps provider authentication failures (403)', async () => {
    fetchImpl = (input, init) => {
      fetchCalls.push({ input, init });
      return Promise.resolve(Response.json({ error: { message: 'Forbidden' } }, { status: 403 }));
    };

    const result = await requestCardChatCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(502);
    expect(result.name).toBe('assist-provider-auth-failed');
  });

  it('maps network failures to unreachable errors', async () => {
    fetchImpl = () => Promise.reject(new Error('network-down'));

    const result = await requestCardChatCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(502);
    expect(result.name).toBe('assist-provider-unreachable');
  });

  it('rejects responses with no choices', async () => {
    fetchImpl = (input, init) => {
      fetchCalls.push({ input, init });
      return Promise.resolve(Response.json({ model: 'gpt-4.1-mini', choices: [] }));
    };

    const result = await requestCardChatCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(502);
    expect(result.name).toBe('assist-provider-response-invalid');
  });

  it('rejects responses with empty message content', async () => {
    fetchImpl = (input, init) => {
      fetchCalls.push({ input, init });
      return Promise.resolve(
        Response.json({
          model: 'gpt-4.1-mini',
          choices: [{ message: { content: '' } }],
        })
      );
    };

    const result = await requestCardChatCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(502);
    expect(result.name).toBe('assist-provider-response-invalid');
  });

  it('maps generic server error (500) from provider', async () => {
    fetchImpl = (input, init) => {
      fetchCalls.push({ input, init });
      return Promise.resolve(
        Response.json({ error: { message: 'Internal server error' } }, { status: 500 })
      );
    };

    const result = await requestCardChatCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(502);
    expect(result.name).toBe('assist-provider-request-failed');
    expect(result.message).toBe('Internal server error');
  });

  it('uses provider message field as fallback error text', async () => {
    fetchImpl = (input, init) => {
      fetchCalls.push({ input, init });
      return Promise.resolve(Response.json({ message: 'Something went wrong' }, { status: 400 }));
    };

    const result = await requestCardChatCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(502);
    expect(result.name).toBe('assist-provider-request-failed');
    expect(result.message).toBe('Something went wrong');
  });

  it('handles non-JSON error responses gracefully', async () => {
    fetchImpl = (input, init) => {
      fetchCalls.push({ input, init });
      return Promise.resolve(new Response('plain text error', { status: 502 }));
    };

    const result = await requestCardChatCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(502);
    expect(result.name).toBe('assist-provider-request-failed');
    expect(result.message).toBe('plain text error');
  });

  it('falls back to config model when response model is missing', async () => {
    fetchImpl = (input, init) => {
      fetchCalls.push({ input, init });
      return Promise.resolve(
        Response.json({
          choices: [{ message: { content: 'No model field.' } }],
        })
      );
    };

    const result = await requestCardChatCompletion({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result.status).toBe(200);
    expect(result.data?.model).toBe('gpt-4.1-mini');
    expect(result.data?.message).toBe('No model field.');
  });
});
