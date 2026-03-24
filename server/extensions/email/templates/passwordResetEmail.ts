// server/extensions/email/templates/passwordResetEmail.ts
// Builds the plain-text and HTML bodies for password reset emails.

interface PasswordResetEmailInput {
  resetUrl: string;
  expiresIn: string;
}

export function buildPasswordResetEmail({
  resetUrl,
  expiresIn,
}: PasswordResetEmailInput): { subject: string; html: string; text: string } {
  const subject = 'Reset your password — Taskinate';

  const text = `You requested a password reset for your Taskinate account.\n\nClick the link below to set a new password:\n\n${resetUrl}\n\nThis link expires in ${expiresIn}.\n\nIf you did not request this, you can safely ignore this email.`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">Reset your password</h1>
  <p style="color:#475569;margin-bottom:24px">You requested a password reset for your Taskinate account. Click the button below to set a new password. The link expires in ${expiresIn}.</p>
  <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Reset password</a>
  <p style="color:#94a3b8;font-size:13px;margin-top:24px">If you did not request a password reset, you can safely ignore this email.</p>
</body>
</html>`.trim();

  return { subject, html, text };
}
