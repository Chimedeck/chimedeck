import { wrapInBaseTemplate, type EmailTemplateOutput } from './shared';

interface CardMemberAssignedEmailInput {
  actorName: string;
  cardTitle: string;
  boardName: string;
  cardUrl: string;
}

export function renderCardMemberAssignedEmail({
  actorName,
  cardTitle,
  boardName,
  cardUrl,
}: CardMemberAssignedEmailInput): EmailTemplateOutput {
  const subject = `${actorName} was assigned to "${cardTitle}"`;

  const bodyHtml = `
    <p style="font-size:16px;margin-bottom:16px">
      <strong>${actorName}</strong> was assigned to the card <strong>${cardTitle}</strong>.
    </p>
    <a href="${cardUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">View card</a>`;

  const bodyText = `${actorName} was assigned to "${cardTitle}" on ${boardName}.\n\nView card: ${cardUrl}`;

  return wrapInBaseTemplate({ subject, bodyHtml, bodyText, boardName });
}
