import { wrapInBaseTemplate, type EmailTemplateOutput } from './shared';

interface CardCommentedEmailInput {
  actorName: string;
  cardTitle: string;
  boardName: string;
  commentPreview: string;
  cardUrl: string;
}

export function renderCardCommentedEmail({
  actorName,
  cardTitle,
  boardName,
  commentPreview,
  cardUrl,
}: CardCommentedEmailInput): EmailTemplateOutput {
  const subject = `${actorName} commented on "${cardTitle}"`;

  const bodyHtml = `
    <p style="font-size:16px;margin-bottom:8px">
      <strong>${actorName}</strong> commented on <strong>${cardTitle}</strong>:
    </p>
    <blockquote style="border-left:3px solid #e2e8f0;margin:0 0 16px;padding:8px 16px;color:#475569;font-style:italic">
      ${commentPreview}
    </blockquote>
    <a href="${cardUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View card</a>`;

  const bodyText = `${actorName} commented on "${cardTitle}":\n\n"${commentPreview}"\n\nView card: ${cardUrl}`;

  return wrapInBaseTemplate({ subject, bodyHtml, bodyText, boardName });
}
