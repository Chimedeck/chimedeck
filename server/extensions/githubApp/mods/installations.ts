// Persistence layer for the github_app_installations table.
// Used by the webhook dispatcher to upsert / suspend / uninstall rows.
import { db } from '../../../common/db';

export interface InstallationRepo {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
}

export interface InstallationRow {
  installation_id: string;
  account_login: string;
  account_type: string;
  workspace_id: string | null;
  repositories: InstallationRepo[];
  suspended: boolean;
  webhook_secret_encrypted: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertInstallationInput {
  installationId: string;
  accountLogin: string;
  accountType: string;
  repositories?: InstallationRepo[];
  suspended?: boolean;
  webhookSecretEncrypted?: string | null;
  workspaceId?: string | null;
}

export async function getInstallationById({
  installationId,
}: {
  installationId: string;
}): Promise<InstallationRow | null> {
  const row = await db('github_app_installations')
    .where({ installation_id: installationId })
    .first();
  return (row as InstallationRow | undefined) ?? null;
}

export async function getInstallationWebhookSecret({
  installationId,
}: {
  installationId: string;
}): Promise<string | null> {
  const row = await db('github_app_installations')
    .where({ installation_id: installationId })
    .select('webhook_secret_encrypted')
    .first();
  const encrypted = (row?.webhook_secret_encrypted as string | undefined) ?? null;
  return encrypted;
}

export async function upsertInstallation({
  installationId,
  accountLogin,
  accountType,
  repositories,
  suspended,
  webhookSecretEncrypted,
  workspaceId,
}: UpsertInstallationInput): Promise<void> {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: now };
  if (accountLogin !== undefined) updates.account_login = accountLogin;
  if (accountType !== undefined) updates.account_type = accountType;
  if (repositories !== undefined) updates.repositories = JSON.stringify(repositories);
  if (suspended !== undefined) updates.suspended = suspended;
  if (webhookSecretEncrypted !== undefined)
    updates.webhook_secret_encrypted = webhookSecretEncrypted;
  if (workspaceId !== undefined) updates.workspace_id = workspaceId;

  // SQLite (used in some test envs) does not support ON CONFLICT … DO UPDATE.
  // We do an explicit select-then-insert/update so the same code runs everywhere.
  const existing = await db('github_app_installations')
    .where({ installation_id: installationId })
    .first();

  if (existing) {
    await db('github_app_installations').where({ installation_id: installationId }).update(updates);
  } else {
    await db('github_app_installations').insert({
      installation_id: installationId,
      account_login: accountLogin,
      account_type: accountType,
      workspace_id: workspaceId ?? null,
      repositories: JSON.stringify(repositories ?? []),
      suspended: suspended ?? false,
      webhook_secret_encrypted: webhookSecretEncrypted ?? null,
      created_at: now,
      updated_at: now,
    });
  }
}

export async function deleteInstallation({
  installationId,
}: {
  installationId: string;
}): Promise<void> {
  await db('github_app_installations').where({ installation_id: installationId }).delete();
}
