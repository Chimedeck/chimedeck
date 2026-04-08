// server/extensions/email/templates/passwordResetEmail.ts
// Builds the plain-text and HTML bodies for password reset emails.

import { renderTemplate } from './render';

interface PasswordResetEmailInput {
  resetUrl: string;
  expiresIn: string;
}

export async function buildPasswordResetEmail({
  resetUrl,
  expiresIn,
}: PasswordResetEmailInput): Promise<{ subject: string; html: string; text: string }> {
  const subject = 'Reset your password — ChimeDeck';

  const text = `You requested a password reset for your ChimeDeck account.\n\nClick the link below to set a new password:\n\n${resetUrl}\n\nThis link expires in ${expiresIn}.\n\nIf you did not request this, you can safely ignore this email.`;

  const html = await renderTemplate({
    templateName: 'passwordResetEmail',
    data: { resetUrl, expiresIn },
  });

  return { subject, html, text };
}
