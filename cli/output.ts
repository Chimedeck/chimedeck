// Output formatting for the taskinate CLI.
// --json mode prints raw JSON; default mode prints a human-readable summary.

export function print(data: unknown, jsonMode: boolean): void {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    // Pretty-print: if data is an object, extract key fields for a one-liner.
    if (data !== null && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const summary = buildSummary(obj);
      console.log(summary ?? JSON.stringify(data, null, 2));
    } else {
      console.log(String(data));
    }
  }
}

function buildSummary(obj: Record<string, unknown>): string | null {
  // Nested data wrapper — unwrap first
  if ('data' in obj && typeof obj.data === 'object' && obj.data !== null) {
    return buildSummary(obj.data as Record<string, unknown>);
  }

  const lines: string[] = [];
  if (obj.id) lines.push(`id: ${obj.id}`);
  if (obj.title) lines.push(`title: ${obj.title}`);
  if (obj.text) lines.push(`text: ${obj.text}`);
  if (obj.listId || obj.list_id) lines.push(`list: ${obj.listId ?? obj.list_id}`);
  if (obj.email) lines.push(`email: ${obj.email}`);
  if (obj.role) lines.push(`role: ${obj.role}`);

  return lines.length > 0 ? `✓ ${lines.join(', ')}` : null;
}
