// emailDispatch.ts — Gated email notification dispatch helper.
// Checks feature flags and user preferences before rendering a template and
// calling SES. Email failures are fire-and-forget; they never throw.
import { db } from '../../../common/db';
import { flags } from '../../../mods/flags';
import { sendViaSes } from '../../email/mods/ses';
import { env } from '../../../config/env';
import { preferenceGuard } from './preferenceGuard';
import type { NotificationType } from './preferenceGuard';
import { renderMentionEmail } from './emailTemplates/mention';
import { renderCardCreatedEmail } from './emailTemplates/cardCreated';
import { renderCardMovedEmail } from './emailTemplates/cardMoved';
import { renderCardCommentedEmail } from './emailTemplates/cardCommented';

export async function dispatchNotificationEmail({
  recipientId,
  type,
  templateData,
}: {
  recipientId: string;
  type: NotificationType;
  templateData: Record<string, string>;
}): Promise<void> {
  try {
    // Gate 1: server feature flags — both must be on
    const [sesEnabled, emailNotificationsEnabled] = await Promise.all([
      flags.isEnabled('SES_ENABLED'),
      flags.isEnabled('EMAIL_NOTIFICATIONS_ENABLED'),
    ]);
    if (!sesEnabled || !emailNotificationsEnabled) return;

    // Gate 2: user preference — return early if email_enabled is false for this type
    if (env.NOTIFICATION_PREFERENCES_ENABLED) {
      const pref = await preferenceGuard({ userId: recipientId, type });
      if (!pref.email_enabled) return;
    }

    // Fetch recipient email address
    const recipient = await db('users')
      .where({ id: recipientId })
      .select('email')
      .first();
    if (!recipient?.email) return;

    // Render template
    const { subject, html, text } = renderTemplate(type, templateData);

    await sendViaSes({ to: recipient.email, subject, html, text });
  } catch (err) {
    // Never propagate — email failure must not block the originating mutation
    console.warn('[emailDispatch] Failed to send notification email:', err);
  }
}

function renderTemplate(type: NotificationType, data: Record<string, string>) {
  switch (type) {
    case 'mention':
      return renderMentionEmail({
        actorName: data.actorName ?? '',
        cardTitle: data.cardTitle ?? '',
        boardName: data.boardName ?? '',
        cardUrl: data.cardUrl ?? '',
      });
    case 'card_created':
      return renderCardCreatedEmail({
        cardTitle: data.cardTitle ?? '',
        boardName: data.boardName ?? '',
        listName: data.listName ?? '',
        cardUrl: data.cardUrl ?? '',
      });
    case 'card_moved':
      return renderCardMovedEmail({
        cardTitle: data.cardTitle ?? '',
        fromList: data.fromList ?? '',
        toList: data.toList ?? '',
        boardName: data.boardName ?? '',
        cardUrl: data.cardUrl ?? '',
      });
    case 'card_commented':
      return renderCardCommentedEmail({
        actorName: data.actorName ?? '',
        cardTitle: data.cardTitle ?? '',
        boardName: data.boardName ?? '',
        commentPreview: data.commentPreview ?? '',
        cardUrl: data.cardUrl ?? '',
      });
  }
}
