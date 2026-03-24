// server/extensions/email/templates/emailChangeConfirmation.ts
// Builds the plain-text and HTML bodies for email-change confirmation emails.

interface EmailChangeConfirmationInput {
  newEmail: string;
  confirmUrl: string;
  expiresIn: string;
}

export function buildEmailChangeConfirmation({
  newEmail,
  confirmUrl,
  expiresIn,
}: EmailChangeConfirmationInput): { subject: string; html: string; text: string } {
  const subject = 'Confirm your email change — Taskinate';

  const text = `You requested to change your Taskinate account email to ${newEmail}.\n\nConfirm the change by visiting the link below:\n\n${confirmUrl}\n\nThis link expires in ${expiresIn}.\n\nIf you did not request this change, you can safely ignore this email.`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">Confirm your email change</h1>
  <p style="color:#475569;margin-bottom:8px">You requested to change your Taskinate account email to:</p>
  <p style="font-weight:600;margin-bottom:24px">${newEmail}</p>
  <p style="color:#475569;margin-bottom:24px">Click the button below to confirm. The link expires in ${expiresIn}.</p>
  <a href="${confirmUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Confirm email change</a>
  <p style="color:#94a3b8;font-size:13px;margin-top:24px">If you did not request this change, you can safely ignore this email.</p>
</body>
</html>`.trim();

  return { subject, html, text };
}
