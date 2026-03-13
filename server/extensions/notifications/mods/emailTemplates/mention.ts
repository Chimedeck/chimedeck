import { wrapInBaseTemplate, type EmailTemplateOutput } from './shared';

interface MentionEmailInput {
  actorName: string;
  cardTitle: string;
  boardName: string;
  cardUrl: string;
}

export function renderMentionEmail({
  actorName,
  cardTitle,
  boardName,
  cardUrl,
}: MentionEmailInput): EmailTemplateOutput {
  const subject = `${actorName} mentioned you in "${cardTitle}"`;

  const bodyHtml = `
    <p style="font-size:16px;margin-bottom:16px">
      <strong>${actorName}</strong> mentioned you in the card <strong>${cardTitle}</strong>.
    </p>
    <a href="${cardUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View card</a>`;

  const bodyText = `${actorName} mentioned you in "${cardTitle}".\n\nView card: ${cardUrl}`;

  return wrapInBaseTemplate({ subject, bodyHtml, bodyText, boardName });
}
