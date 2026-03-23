import { wrapInBaseTemplate, type EmailTemplateOutput } from './shared';

interface CardArchivedEmailInput {
  actorName: string;
  cardTitle: string;
  boardName: string;
  archived: boolean; // true = archived, false = unarchived
  cardUrl: string;
}

export function renderCardArchivedEmail({
  actorName,
  cardTitle,
  boardName,
  archived,
  cardUrl,
}: CardArchivedEmailInput): EmailTemplateOutput {
  const action = archived ? 'archived' : 'unarchived';
  const subject = `${actorName} ${action} "${cardTitle}" in ${boardName}`;

  const bodyHtml = `
    <p style="font-size:16px;margin-bottom:16px">
      <strong>${actorName}</strong> ${action} the card <strong>${cardTitle}</strong> in <strong>${boardName}</strong>.
    </p>
    <a href="${cardUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View card</a>`;

  const bodyText = `${actorName} ${action} "${cardTitle}" in ${boardName}.\n\nView card: ${cardUrl}`;

  return wrapInBaseTemplate({ subject, bodyHtml, bodyText, boardName });
}
