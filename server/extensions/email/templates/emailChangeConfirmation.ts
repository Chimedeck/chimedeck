// server/extensions/email/templates/emailChangeConfirmation.ts
// Builds the plain-text and HTML bodies for email-change confirmation emails.

import { renderTemplate } from './render';

interface EmailChangeConfirmationInput {
  newEmail: string;
  confirmUrl: string;
  expiresIn: string;
}

export async function buildEmailChangeConfirmation({
  newEmail,
  confirmUrl,
  expiresIn,
}: EmailChangeConfirmationInput): Promise<{ subject: string; html: string; text: string }> {
  const subject = 'Confirm your email change — Taskinate';

  const text = `You requested to change your Taskinate account email to ${newEmail}.\n\nConfirm the change by visiting the link below:\n\n${confirmUrl}\n\nThis link expires in ${expiresIn}.\n\nIf you did not request this change, you can safely ignore this email.`;

  const html = await renderTemplate({
    templateName: 'emailChangeConfirmation',
    data: { newEmail, confirmUrl, expiresIn },
  });

  return { subject, html, text };
}
