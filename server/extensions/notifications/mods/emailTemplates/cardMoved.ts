import { wrapInBaseTemplate, type EmailTemplateOutput } from './shared';

interface CardMovedEmailInput {
  cardTitle: string;
  fromList: string;
  toList: string;
  boardName: string;
  cardUrl: string;
}

export function renderCardMovedEmail({
  cardTitle,
  fromList,
  toList,
  boardName,
  cardUrl,
}: CardMovedEmailInput): EmailTemplateOutput {
  const subject = `Card "${cardTitle}" was moved to "${toList}"`;

  const bodyHtml = `
    <p style="font-size:16px;margin-bottom:16px">
      The card <strong>${cardTitle}</strong> was moved from <strong>${fromList}</strong> to <strong>${toList}</strong>.
    </p>
    <a href="${cardUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View card</a>`;

  const bodyText = `Card "${cardTitle}" was moved from "${fromList}" to "${toList}" on ${boardName}.\n\nView card: ${cardUrl}`;

  return wrapInBaseTemplate({ subject, bodyHtml, bodyText, boardName });
}
