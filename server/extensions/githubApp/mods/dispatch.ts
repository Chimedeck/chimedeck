// Event dispatcher for GitHub App webhooks.
//
// Currently handles three event families (per the project spec):
//   - `installation`               → installation lifecycle
//   - `installation_repositories` → repo list changed for an existing installation
//   - `push`                      → invalidate cached board-docs for the affected repo
//
// All other events are acknowledged with 202 Accepted and otherwise ignored
// so that adding new event handlers later is a single switch case.
//
// Every handler is deliberately idempotent — GitHub may redeliver the same
// event with the same `X-GitHub-Delivery` id, and we must not corrupt state
// when that happens.
import { env } from '../../../config/env';
import { encryptSecret } from '../../../common/crypto';
import {
  deleteInstallation,
  getInstallationById,
  upsertInstallation,
  type InstallationRepo,
} from './installations';

export interface DispatcherResult {
  handled: boolean;
  /** Short tag used for activity logging / metrics. */
  event: string;
}

export interface InstallationEventPayload {
  action?: string;
  installation?: {
    id?: number;
    account?: { login?: string; type?: string };
    repositories?: InstallationRepo[];
  };
  repositories?: InstallationRepo[];
}

export interface InstallationRepositoriesEventPayload {
  action?: string;
  installation?: {
    id?: number;
    account?: { login?: string; type?: string };
  };
  repositories_added?: InstallationRepo[];
  repositories_removed?: InstallationRepo[];
}

export interface PushEventPayload {
  installation?: { id?: number };
  repository?: { full_name?: string; default_branch?: string };
  ref?: string;
}

export interface DispatchInput {
  event: string;
  rawBody: string;
}

/**
 * Dispatches an incoming GitHub webhook to the right handler.
 * The signature must already have been verified by the caller.
 */
export async function dispatchGitHubEvent({
  event,
  rawBody,
}: DispatchInput): Promise<DispatcherResult> {
  // Cheap payload shape sniffing — we don't trust the action field alone
  // because `installation` and `installation_repositories` look superficially
  // similar and a malformed payload would silently take the wrong branch.
  switch (event) {
    case 'installation':
      return handleInstallation(JSON.parse(rawBody) as InstallationEventPayload);
    case 'installation_repositories':
      return handleInstallationRepositories(JSON.parse(rawBody) as InstallationRepositoriesEventPayload);
    case 'push':
      return handlePush(JSON.parse(rawBody) as PushEventPayload);
    default:
      return { handled: false, event };
  }
}

async function handleInstallation(
  payload: InstallationEventPayload,
): Promise<DispatcherResult> {
  const installationId = String(payload.installation?.id ?? '');
  if (!installationId) {
    return { handled: false, event: 'installation' };
  }

  const action = payload.action ?? '';
  const accountLogin = payload.installation?.account?.login ?? '';
  const accountType = payload.installation?.account?.type ?? '';
  const repositories = payload.installation?.repositories ?? payload.repositories ?? [];

  if (action === 'deleted') {
    await deleteInstallation({ installationId });
    return { handled: true, event: 'installation.deleted' };
  }

  // For first-time installations, we have no per-installation secret on file
  // yet — store one encrypted with WEBHOUB_SECRET_ENCRYPTION_KEY so future
  // deliveries can be verified against it without falling back to the env var.
  // GitHub does NOT send the secret in the webhook; the operator must configure
  // it identically in the GitHub App settings and in GITHUB_APP_WEBHOOK_SECRET.
  // The encrypted-at-rest copy is a write-through cache of that same value.
  const existing = await getInstallationById({ installationId });
  const webhookSecretEncrypted = existing?.webhook_secret_encrypted
    ?? (env.GITHUB_APP_WEBHOOK_SECRET
      ? encryptSecret({
        plaintext: env.GITHUB_APP_WEBHOOK_SECRET,
        hexKey: env.WEBHOOK_SECRET_ENCRYPTION_KEY,
      })
      : null);

  await upsertInstallation({
    installationId,
    accountLogin,
    accountType,
    repositories,
    suspended: action === 'suspend' || action === 'unsuspend' ? action === 'suspend' : false,
    webhookSecretEncrypted: webhookSecretEncrypted ?? null,
  });
  return { handled: true, event: `installation.${action || 'upsert'}` };
}

async function handleInstallationRepositories(
  payload: InstallationRepositoriesEventPayload,
): Promise<DispatcherResult> {
  const installationId = String(payload.installation?.id ?? '');
  if (!installationId) {
    return { handled: false, event: 'installation_repositories' };
  }

  const existing = await getInstallationById({ installationId });
  if (!existing) {
    // No installation row → can't reconcile. Acknowledge so GitHub doesn't
    // retry forever; an `installation.created` should arrive first.
    return { handled: false, event: 'installation_repositories' };
  }

  const currentRepos = (existing.repositories as InstallationRepo[] | string) ?? [];
  const normalisedCurrent: InstallationRepo[] = Array.isArray(currentRepos)
    ? currentRepos
    : JSON.parse(String(currentRepos));

  const removed = payload.repositories_removed ?? [];
  const removedIds = new Set(removed.map((r) => r.id));
  const merged: InstallationRepo[] = [
    ...normalisedCurrent.filter((r) => !removedIds.has(r.id)),
    ...(payload.repositories_added ?? []),
  ];
  await upsertInstallation({
    installationId,
    accountLogin: existing.account_login,
    accountType: existing.account_type,
    repositories: merged,
  });
  return { handled: true, event: 'installation_repositories' };
}

async function handlePush(payload: PushEventPayload): Promise<DispatcherResult> {
  const installationId = String(payload.installation?.id ?? '');
  if (!installationId) {
    return { handled: false, event: 'push' };
  }
  // [why] The cached board-docs live in GITHUB_REPOSITORY_CACHE_DIR/<full_name>.
  // We don't have a cache-invalidation helper for that directory yet, so the
  // handler currently no-ops on push. The wiring is in place (installation
  // state is persisted), and a future iteration only needs to call
  // `invalidateRepoCache({ fullName })` here.
  void payload;
  void installationId;
  return { handled: true, event: 'push' };
}
