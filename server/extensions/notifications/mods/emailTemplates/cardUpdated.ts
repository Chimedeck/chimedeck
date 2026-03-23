import { wrapInBaseTemplate, type EmailTemplateOutput } from './shared';

interface CardUpdatedEmailInput {
  actorName: string;
  cardTitle: string;
  boardName: string;
  changedFields: string[]; // e.g. ['title', 'due_date']
  cardUrl: string;
}

// 'due_date' → 'due date', 'title' → 'title', etc.
function humaniseFieldName(field: string): string {
  return field.replace(/_/g, ' ');
}

export function renderCardUpdatedEmail({
  actorName,
  cardTitle,
  boardName,
  changedFields,
  cardUrl,
}: CardUpdatedEmailInput): EmailTemplateOutput {
  const fieldList = changedFields.map(humaniseFieldName).join(', ');
  const subject = `${actorName} updated "${cardTitle}" in ${boardName}`;

  const bodyHtml = `
    <p style="font-size:16px;margin-bottom:16px">
      <strong>${actorName}</strong> made changes to <strong>${cardTitle}</strong> in <strong>${boardName}</strong>${fieldList ? ` (${fieldList})` : ''}.
    </p>
    <a href="${cardUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View card</a>`;

  const bodyText = `${actorName} updated "${cardTitle}" in ${boardName}${fieldList ? ` (${fieldList})` : ''}.\n\nView card: ${cardUrl}`;

  return wrapInBaseTemplate({ subject, bodyHtml, bodyText, boardName });
}
