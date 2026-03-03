// server/extensions/email/index.ts
// Routes email via AWS SES or console based on the SES_ENABLED feature flag.
import { flags } from '../../mods/flags';
import { sendViaSes } from './mods/ses';
import { sendViaConsole } from './mods/console';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function send(payload: EmailPayload): Promise<void> {
  const useSes = await flags.isEnabled('SES_ENABLED');
  if (useSes) {
    await sendViaSes(payload);
  } else {
    await sendViaConsole(payload);
  }
}
