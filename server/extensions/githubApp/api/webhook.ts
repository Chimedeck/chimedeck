// POST /api/v1/github/webhook — receives GitHub App webhook deliveries.
//
// Flow:
//   1. Read the raw body (signature is computed over the literal bytes, so
//      any reformatting here would break verification).
//   2. Look up candidate signing secrets: the per-installation secret
//      decrypted from the DB, then the GITHUB_APP_WEBHOOK_SECRET fallback.
//   3. Verify the X-Hub-Signature-256 HMAC. Reject with 401 if it doesn't
//      match any candidate.
//   4. Dispatch by `X-GitHub-Event` to the event handler.
//   5. Always return 202 Accepted — never echo GitHub's payload back, never
//      leak error details that could help an attacker probe the handler.
import { env } from '../../../config/env';
import { decryptSecret } from '../../../common/crypto';
import { getInstallationWebhookSecret } from '../mods/installations';
import {
  GITHUB_SIGNATURE_HEADER,
  verifyGitHubWebhookSignature,
} from '../mods/verifySignature';
import { dispatchGitHubEvent } from '../mods/dispatch';

const EVENT_HEADER = 'x-github-event';

function notImplemented(): Response {
  return new Response(
    JSON.stringify({ name: 'not-implemented', data: { message: 'GitHub webhooks are not enabled' } }),
    { status: 501, headers: { 'Content-Type': 'application/json' } },
  );
}

function unauthorized(): Response {
  return new Response(
    JSON.stringify({ name: 'unauthorized', data: { message: 'Invalid signature' } }),
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  );
}

function badRequest(message: string): Response {
  return new Response(
    JSON.stringify({ name: 'bad-request', data: { message } }),
    { status: 400, headers: { 'Content-Type': 'application/json' } },
  );
}

function accepted(): Response {
  return new Response(
    JSON.stringify({ data: { ok: true } }),
    { status: 202, headers: { 'Content-Type': 'application/json' } },
  );
}

export async function handleGitHubWebhook(req: Request): Promise<Response> {
  if (!env.GITHUB_WEBHOOKS_ENABLED) return notImplemented();
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ name: 'method-not-allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', Allow: 'POST' } },
    );
  }

  // [why] req.text() reads the raw bytes — critical for HMAC verification.
  const rawBody = await req.text();
  if (!rawBody) return badRequest('Empty request body');

  const signatureHeader = req.headers.get(GITHUB_SIGNATURE_HEADER);
  const event = req.headers.get(EVENT_HEADER) ?? '';

  // [why] Resolve candidate secrets at the latest possible moment: even if the
  // request is for an installation we don't know about yet (very first
  // `installation.created`), the env fallback can still verify it.
  const candidateSecrets: string[] = [];
  let installationId: string | null = null;
  try {
    const parsed = JSON.parse(rawBody) as { installation?: { id?: number } };
    if (parsed.installation?.id !== undefined) {
      installationId = String(parsed.installation.id);
    }
  } catch {
    return badRequest('Invalid JSON');
  }

  if (installationId) {
    const encrypted = await getInstallationWebhookSecret({ installationId });
    if (encrypted) {
      try {
        candidateSecrets.push(decryptSecret({
          ciphertext: encrypted,
          hexKey: env.WEBHOOK_SECRET_ENCRYPTION_KEY,
        }));
      } catch {
        // Bad ciphertext — log and fall through to the env fallback.
      }
    }
  }
  if (env.GITHUB_APP_WEBHOOK_SECRET) {
    candidateSecrets.push(env.GITHUB_APP_WEBHOOK_SECRET);
  }

  const isValid = verifyGitHubWebhookSignature({
    rawBody,
    signatureHeader,
    candidateSecrets,
  });
  if (!isValid) return unauthorized();

  // Dispatch after verification — we never touch DB state for unverified payloads.
  try {
    await dispatchGitHubEvent({ event, rawBody });
  } catch {
    // Swallow handler errors so a transient DB blip doesn't cause GitHub to
    // keep retrying forever; the dispatcher is itself idempotent.
  }
  return accepted();
}
