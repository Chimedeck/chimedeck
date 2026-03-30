// server/extensions/email/templates/adminInvite.ts
// Builds the plain-text and HTML bodies for admin invitation emails.

import { renderTemplate } from './render';

interface AdminInviteEmailParams {
  inviterName: string;
  newUserEmail: string;
  plainPassword: string;
  loginUrl: string;
}

export interface EmailPayload {
  subject: string;
  html: string;
  text: string;
}

export async function adminInviteEmail({
  inviterName,
  newUserEmail,
  plainPassword,
  loginUrl,
}: AdminInviteEmailParams): Promise<EmailPayload> {
  const subject = 'You have been invited to Taskinate';

  const text = [
    `You have been invited to Taskinate by ${inviterName}.`,
    '',
    'Your login details:',
    `  Email:    ${newUserEmail}`,
    `  Password: ${plainPassword}`,
    '',
    `Log in here: ${loginUrl}`,
    '',
    'Please change your password after your first login.',
    '',
    'If you did not expect this invitation, you can safely ignore this email.',
  ].join('\n');

  const html = await renderTemplate({
    templateName: 'adminInvite',
    data: { inviterName, newUserEmail, plainPassword, loginUrl },
  });

  return { subject, html, text };
}
