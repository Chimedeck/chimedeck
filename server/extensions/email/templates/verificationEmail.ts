// server/extensions/email/templates/verificationEmail.ts
// Builds the plain-text and HTML bodies for verification emails.

import { renderTemplate } from './render';

interface VerificationEmailInput {
  verificationUrl: string;
}

export async function buildVerificationEmail({ verificationUrl }: VerificationEmailInput): Promise<{
  subject: string;
  html: string;
  text: string;
}> {
  const subject = 'Verify your email — ChimeDeck';

  const text = `Welcome to ChimeDeck!\n\nPlease verify your email address by visiting the link below:\n\n${verificationUrl}\n\nThis link expires in 24 hours.\n\nIf you did not create an account, you can safely ignore this email.`;

  const html = await renderTemplate({ templateName: 'verification', data: { verificationUrl } });

  return { subject, html, text };
}
