// Base HTML email wrapper for all notification emails.
// All templates call wrapInBaseTemplate to ensure a consistent header/footer.

export interface EmailTemplateOutput {
  subject: string;
  html: string;
  text: string;
}

const PREFERENCES_URL = '/settings/profile?tab=notifications';

export function wrapInBaseTemplate({
  subject,
  bodyHtml,
  bodyText,
  boardName,
}: {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  boardName: string;
}): EmailTemplateOutput {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <div style="border-bottom:1px solid #e2e8f0;padding-bottom:16px;margin-bottom:24px">
    <span style="font-size:20px;font-weight:700;color:#4f46e5">HoriFlow</span>
  </div>
  ${bodyHtml}
  <div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:32px;color:#94a3b8;font-size:13px">
    You received this because you are a member of <strong>${boardName}</strong>.
    <a href="${PREFERENCES_URL}" style="color:#4f46e5;text-decoration:none">Manage notification preferences</a>
  </div>
</body>
</html>`.trim();

  const text = `${bodyText}\n\n---\nYou received this because you are a member of ${boardName}.\nManage notification preferences: ${PREFERENCES_URL}`;

  return { subject, html, text };
}
