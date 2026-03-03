// server/extensions/email/mods/console.ts
// Dev fallback — logs email content to stdout instead of sending.
import type { EmailPayload } from './ses';

export async function sendViaConsole({ to, subject, text }: EmailPayload): Promise<void> {
  console.log('[email:console]', JSON.stringify({ to, subject, text }, null, 2));
}
