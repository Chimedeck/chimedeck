import type { CliConfig } from './config';

// Shared fetch wrapper used by all CLI commands.
// Attaches Authorization header; on 4xx/5xx exits with code 1.
export async function call<T>({
  config,
  method,
  path,
  body,
}: {
  config: CliConfig;
  method: string;
  path: string;
  body?: unknown;
}): Promise<T> {
  const url = `${config.apiUrl}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    console.error(`Error: Unable to connect to ${config.apiUrl}. Check your network or TASKINATE_API_URL.`);
    process.exit(1);
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const errPayload = payload as { name?: string; data?: unknown } | null;
    const name = errPayload?.name ?? `http-${res.status}`;
    const data = errPayload?.data;
    console.error(`Error: ${name}${data ? `\n  ${JSON.stringify(data)}` : ''}`);
    process.exit(1);
  }

  return payload as T;
}
