// server/extensions/email/templates/adminInvite.ts
// Builds the plain-text and HTML bodies for admin invitation emails.

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

export function adminInviteEmail({
  inviterName,
  newUserEmail,
  plainPassword,
  loginUrl,
}: AdminInviteEmailParams): EmailPayload {
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

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">You have been invited to Taskinate</h1>
  <p style="color:#475569;margin-bottom:16px">
    <strong>${inviterName}</strong> has created an account for you on Taskinate.
  </p>
  <table style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;background:#f8fafc;margin-bottom:24px;width:100%;border-collapse:collapse">
    <tr><td style="padding:6px 12px;font-weight:600;width:120px">Email</td><td style="padding:6px 12px">${newUserEmail}</td></tr>
    <tr><td style="padding:6px 12px;font-weight:600">Password</td><td style="padding:6px 12px;font-family:monospace">${plainPassword}</td></tr>
  </table>
  <a href="${loginUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Log in to Taskinate</a>
  <p style="color:#94a3b8;font-size:13px;margin-top:24px">Please change your password after your first login.</p>
  <p style="color:#94a3b8;font-size:13px">If you did not expect this invitation, you can safely ignore this email.</p>
</body>
</html>`.trim();

  return { subject, html, text };
}
