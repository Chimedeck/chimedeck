// Tracks which ALB instance a chat session was created on so commit requests
// can verify they're hitting the same instance that holds the local git clone.
// Only active when FLAG_ENABLE_MULTI_INSTANCE_HANDLING is true.
//
// [why] In multi-instance deployments behind an ALB with sticky sessions, the
// local git clone (used by specs read/write/commit) lives on a single instance.
// If a commit request lands on a different instance, the locally-written proposal
// files don't exist there, and the commit would fail or produce stale data.
// By recording the ALB cookies at proposal time and checking them at commit time,
// we can detect cross-instance requests and return a clear "session timed out"
// error instead of a confusing git failure.

interface SessionInstanceRecord {
  awsAlb: string;
  awsElb: string;
  recordedAt: number;
}

// [why] In-memory only — these records are ephemeral by design. If the instance
// restarts, all sessions are lost, which is correct: the local git clones are
// also gone. The client will get a timeout error and re-prompt.
const sessionInstanceMap = new Map<string, SessionInstanceRecord>();

// [why] Clean up records older than this to prevent unbounded memory growth.
// 30 minutes is generous — covers the typical gap between AI proposal and user
// clicking "Commit", plus some thinking time.
const MAX_RECORD_AGE_MS = 30 * 60 * 1000;

function parseAlbCookie(cookieHeader: string | null, cookieName: string): string {
  if (!cookieHeader) return '';
  const prefix = `${cookieName}=`;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  }
  return '';
}

function getAlbCookies(request: Request): { awsAlb: string; awsElb: string } {
  const cookieHeader = request.headers.get('cookie');
  return {
    awsAlb: parseAlbCookie(cookieHeader, 'AWSALB'),
    awsElb: parseAlbCookie(cookieHeader, 'AWSELB'),
  };
}

function buildInstanceFingerprint(cookies: { awsAlb: string; awsElb: string }): string {
  return `${cookies.awsAlb}|${cookies.awsElb}`;
}

// [why] Prune expired records on every write so the map doesn't grow
// unbounded over days of uptime.
function pruneExpiredRecords(nowMs: number): void {
  const cutoff = nowMs - MAX_RECORD_AGE_MS;
  for (const [key, record] of sessionInstanceMap) {
    if (record.recordedAt < cutoff) {
      sessionInstanceMap.delete(key);
    }
  }
}

/**
 * Record which ALB instance handled a chat session's proposal generation.
 * Called after the AI generates proposals so the commit endpoint can verify
 * the request lands on the same instance.
 */
export function recordSessionInstance(sessionId: string, request: Request): void {
  const cookies = getAlbCookies(request);
  const nowMs = Date.now();

  pruneExpiredRecords(nowMs);

  sessionInstanceMap.set(sessionId, {
    awsAlb: cookies.awsAlb,
    awsElb: cookies.awsElb,
    recordedAt: nowMs,
  });
}

/**
 * Check whether a commit request for the given session is hitting the same
 * ALB instance that handled the original proposal generation.
 *
 * @returns null if the instance matches (or no record exists — first request),
 *          or an error response if the instance doesn't match.
 */
export function verifySessionInstance(sessionId: string, request: Request): Response | null {
  const record = sessionInstanceMap.get(sessionId);

  // [why] No record means either: (a) this is the first request and it
  // happened to land on the right instance, or (b) the record expired.
  // In case (a) we let it through; in case (b) the local files are gone
  // anyway and git will fail with a clear error. Either way, don't block.
  if (!record) return null;

  const currentCookies = getAlbCookies(request);
  const currentFingerprint = buildInstanceFingerprint(currentCookies);
  const recordedFingerprint = buildInstanceFingerprint({
    awsAlb: record.awsAlb,
    awsElb: record.awsElb,
  });

  if (currentFingerprint !== recordedFingerprint) {
    return Response.json(
      {
        name: 'session-instance-mismatch',
        data: {
          message:
            'This chat session was handled by a different server instance. ' +
            'The proposed changes are no longer available on this instance. ' +
            'Please re-run the AI prompt to generate the proposals again.',
        },
      },
      { status: 409 }
    );
  }

  return null;
}

// [why] Exposed for tests so they can reset state between cases.
export const multiInstanceSessionTrackerInternals = {
  sessionInstanceMap,
  parseAlbCookie,
  getAlbCookies,
  buildInstanceFingerprint,
  MAX_RECORD_AGE_MS,
};
