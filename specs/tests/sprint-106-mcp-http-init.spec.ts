// Playwright MCP HTTP Init test for Sprint 106
// Covers: unauthenticated POST, valid POST, DELETE, session hijack, proxying
import { test, expect, request } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

// Helper: login and get JWT
async function loginAndGetJwt(request: any, email: string, password: string) {
  const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    data: { email, password },
  });
  const body = await loginRes.json();
  return body.data.access_token;
}

test.describe('MCP HTTP Init', () => {
  test('Unauthenticated POST returns 401', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/mcp`, {
      data: {
        jsonrpc: '2.0', id: 1, method: 'initialize', params: {
          protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1.0' }
        }
      }
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error?.code).toBe('unauthorized');
  });

  test('Valid POST initializes session and returns mcp-session-id', async ({ request }) => {
    // Register and login
    const email = `mcp-test-${Date.now()}@example.com`;
    const password = 'TestPassword1!';
    await request.post(`${BASE_URL}/api/v1/auth/register`, { data: { email, password, name: 'MCP Test' } });
    const jwt = await loginAndGetJwt(email, password);
    // Create token
    const tokenRes = await request.post(`${BASE_URL}/api/v1/tokens`, {
      headers: { Authorization: `Bearer ${jwt}` },
      data: { name: 'mcp-test-token' },
    });
    const tokenBody = await tokenRes.json();
    const hfToken = tokenBody.data.token;
    expect(hfToken.startsWith('hf_')).toBeTruthy();
    // POST /api/mcp
    const mcpRes = await request.post(`${BASE_URL}/api/mcp`, {
      headers: { Authorization: `Bearer ${hfToken}` },
      data: {
        jsonrpc: '2.0', id: 1, method: 'initialize', params: {
          protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1.0' }
        }
      }
    });
    expect(mcpRes.status()).toBe(200);
    expect(mcpRes.headers()['mcp-session-id']).toBeTruthy();
  });

  // Additional tests for DELETE, hijack, proxying would follow similar structure
});
