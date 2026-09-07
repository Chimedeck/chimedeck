import { beforeEach, describe, expect, it, mock } from 'bun:test';

const authenticateMock = mock(async (req: Request & { currentUser?: unknown }) => {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (token === 'hf_valid_token') {
    req.currentUser = {
      id: 'user-1',
      email: 'john@example.com',
      name: 'John Doe',
    };
    return null;
  }

  return Response.json(
    { error: { code: 'unauthorized', message: 'Invalid API token' } },
    { status: 401 },
  );
});

mock.module('../../../server/extensions/auth/middlewares/authentication', () => ({
  authenticate: authenticateMock,
}));

const { trelloCompatRouter } = await import('../../../server/extensions/trelloCompat/api/index');

beforeEach(() => {
  authenticateMock.mockClear();
});

describe('trelloCompat auth + members/me', () => {
  it('accepts valid Bearer hf_ token', async () => {
    Bun.env['TRELLO_COMPAT_ENABLED'] = 'true';

    const req = new Request('http://localhost/trello/1/members/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_valid_token' },
    });

    const res = await trelloCompatRouter(req, '/trello/1/members/me');
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);

    const body = await res!.json() as { fullName: string; username: string; initials: string };
    expect(body.fullName).toBe('John Doe');
    expect(body.username).toBe('john');
    expect(body.initials).toBe('JD');
  });

  it('accepts token query param and ignores key query param', async () => {
    Bun.env['TRELLO_COMPAT_ENABLED'] = 'true';

    const req = new Request('http://localhost/trello/1/members/me?key=abc&token=hf_valid_token', {
      method: 'GET',
    });

    const res = await trelloCompatRouter(req, '/trello/1/members/me');
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
  });

  it('returns trello-shaped 401 for invalid token', async () => {
    Bun.env['TRELLO_COMPAT_ENABLED'] = 'true';

    const req = new Request('http://localhost/trello/1/members/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_invalid_token' },
    });

    const res = await trelloCompatRouter(req, '/trello/1/members/me');
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    const body = await res!.json() as { message: string; error: string };
    expect(body).toEqual({ message: 'invalid token', error: 'UNAUTHORIZED' });
  });

  it('returns 501 when TRELLO_COMPAT_ENABLED=false', async () => {
    Bun.env['TRELLO_COMPAT_ENABLED'] = 'false';

    const req = new Request('http://localhost/trello/1/members/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer hf_valid_token' },
    });

    const res = await trelloCompatRouter(req, '/trello/1/members/me');
    expect(res).not.toBeNull();
    expect(res!.status).toBe(501);
  });

  it('does not affect /api routes', async () => {
    Bun.env['TRELLO_COMPAT_ENABLED'] = 'true';

    const req = new Request('http://localhost/api/v1/boards', { method: 'GET' });
    const res = await trelloCompatRouter(req, '/api/v1/boards');
    expect(res).toBeNull();
  });
});
