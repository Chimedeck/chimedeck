import { config } from './config';

// Thin fetch wrapper: injects Authorization header and normalises error shapes.
// token param is optional — stdio mode omits it and falls back to config.token;
// HTTP mode always passes the authenticated user's token from the request.
export async function apiCall<T>({
  method,
  path,
  body,
  token,
}: {
  method: string;
  path: string;
  body?: unknown;
  token?: string;
}): Promise<{ data: T } | { error: { name: string; data?: unknown } }> {
  const url = `${config.apiUrl}${path}`;
  const authToken = token ?? config.token;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const errPayload = payload as { name?: string; data?: unknown } | null;
    return {
      error: {
        name: errPayload?.name ?? `http-${res.status}`,
        data: errPayload?.data ?? payload,
      },
    };
  }

  return { data: payload as T };
}
