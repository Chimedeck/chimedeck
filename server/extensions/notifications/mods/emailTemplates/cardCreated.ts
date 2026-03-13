import { wrapInBaseTemplate, type EmailTemplateOutput } from './shared';

interface CardCreatedEmailInput {
  cardTitle: string;
  boardName: string;
  listName: string;
  cardUrl: string;
}

export function renderCardCreatedEmail({
  cardTitle,
  boardName,
  listName,
  cardUrl,
}: CardCreatedEmailInput): EmailTemplateOutput {
  const subject = `New card "${cardTitle}" was created in ${boardName}`;

  const bodyHtml = `
    <p style="font-size:16px;margin-bottom:16px">
      A new card <strong>${cardTitle}</strong> was created in the <strong>${listName}</strong> list.
    </p>
    <a href="${cardUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View card</a>`;

  const bodyText = `New card "${cardTitle}" was created in the "${listName}" list on ${boardName}.\n\nView card: ${cardUrl}`;

  return wrapInBaseTemplate({ subject, bodyHtml, bodyText, boardName });
}
