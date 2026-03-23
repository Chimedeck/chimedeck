import { wrapInBaseTemplate, type EmailTemplateOutput } from './shared';

interface CardDeletedEmailInput {
  actorName: string;
  cardTitle: string;
  boardName: string;
  // [why] Deleted cards have no URL; link to the board page instead to keep the email actionable.
  boardUrl: string;
}

export function renderCardDeletedEmail({
  actorName,
  cardTitle,
  boardName,
  boardUrl,
}: CardDeletedEmailInput): EmailTemplateOutput {
  const subject = `${actorName} deleted "${cardTitle}" in ${boardName}`;

  const bodyHtml = `
    <p style="font-size:16px;margin-bottom:16px">
      <strong>${actorName}</strong> permanently deleted the card <strong>${cardTitle}</strong> from <strong>${boardName}</strong>.
    </p>
    <a href="${boardUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Open board</a>`;

  const bodyText = `${actorName} deleted "${cardTitle}" from ${boardName}.\n\nOpen board: ${boardUrl}`;

  return wrapInBaseTemplate({ subject, bodyHtml, bodyText, boardName });
}
