// JSON body parser middleware.
// Parses application/json request bodies and attaches the parsed value.
export async function parseJsonBody(req: Request | { headers: { get(name: string): string | null }; json(): Promise<unknown> }): Promise<unknown> {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined;

  try {
    return (await req.json()) as unknown;
  } catch {
    return undefined;
  }
}
