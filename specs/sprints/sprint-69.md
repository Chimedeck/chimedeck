# Sprint 69 — In-House Virus Scanning with ClamAV

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 59 (Enhanced Attachments — multipart, thumbnails), Sprint 60 (Attachment Upload UI)
> **References:** ClamAV docs — https://docs.clamav.net/

---

## Goal

Replace the current stub virus scanner with a real in-house scan pipeline using **ClamAV** running as a sidecar container. When `VIRUS_SCAN_ENABLED=true` uploaded files are streamed from S3 to the ClamAV daemon (`clamd`), scanned, and the attachment is promoted to `READY` or `REJECTED` accordingly. No third-party API key required.

---

## Scope

### 1. ClamAV Sidecar (Docker)

Add a `clamav` service to `docker-compose.yml` and `docker-compose.prod.yml`:

```yaml
clamav:
  image: clamav/clamav:stable
  restart: unless-stopped
  environment:
    CLAMAV_NO_FRESHCLAMD: "false"   # keep definitions updated
  ports:
    - "3310:3310"                    # clamd TCP (internal only)
  volumes:
    - clamav_db:/var/lib/clamav
```

Add `clamav_db` named volume so virus definitions persist across restarts.

The app container waits for `clamd` by polling the TCP socket in the healthcheck or via a startup retry in the scanner module.

---

### 2. `CLAMAV_HOST` / `CLAMAV_PORT` Config Env Vars

Add to `server/config/env.ts`:

```ts
CLAMAV_HOST: string;   // default: 'clamav'
CLAMAV_PORT: number;   // default: 3310
```

Only read when `VIRUS_SCAN_ENABLED=true`.

---

### 3. ClamAV Scanner Module

**`server/extensions/attachment/mods/virusScan/clamav.ts`**

- Opens a TCP socket to `clamd` using Bun's built-in `Bun.connect` (no npm package needed).
- Sends the `INSTREAM` command protocol: 4-byte big-endian chunk length prefix per chunk, followed by a 4-byte zero terminator.
- Streams the S3 object (fetched via a pre-signed GET URL) in chunks of 64 KB.
- Parses the `stream: OK` / `stream: <VIRUS NAME> FOUND` / `ERROR` response.
- Returns `'READY' | 'REJECTED'`.

Protocol sketch:

```
→ "zINSTREAM\0"
→ [uint32 BE: chunk_len][chunk_bytes]   (repeat per chunk)
→ [uint32 BE: 0]                        (end of stream)
← "stream: OK\n"                        or
← "stream: Eicar-Test-Signature FOUND\n"
```

Timeout: 30 s. If the socket closes or times out, treat as `READY` (fail-open) and log a warning.

---

### 4. Update `worker.ts`

Replace the VirusTotal stub in `server/extensions/attachment/mods/virusScan/worker.ts`:

```ts
import { scanWithClamAV } from './clamav';

async function scanFile({ s3Key }: { s3Key: string }): Promise<'READY' | 'REJECTED'> {
  if (!env.VIRUS_SCAN_API_KEY && !env.CLAMAV_HOST) {
    return 'READY'; // nothing configured — treat as clean
  }
  return scanWithClamAV({ s3Key });
}
```

The function fetches the S3 object URL from `getSignedUrl` (pre-signed GET, TTL 60 s), streams it to ClamAV, and returns the result.

---

### 5. `enqueue.ts` — Pass S3 Key in Message

The message published to the scan queue must include the `s3_key` so the worker can fetch the file:

```ts
await pubsub.publish(SCAN_QUEUE_KEY, JSON.stringify({ attachmentId, s3Key: attachment.s3_key }));
```

Update `enqueue.ts` to accept and forward `s3Key`. The worker already destructures `s3Key` from the message (see existing `worker.ts`).

---

### 6. EICAR Test in Integration Tests

**`tests/integration/attachment/virusScan.test.ts`**

| Scenario | Expected result |
|---|---|
| Upload EICAR test string (`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`) | status → `REJECTED` |
| Upload a normal PNG | status → `READY` |
| ClamAV unreachable (wrong port) | fail-open → `READY`, warning logged |

Tests run only when `VIRUS_SCAN_ENABLED=true` (skip otherwise).

---

### 7. UI — `REJECTED` Attachment State

`AttachmentItem` already has a `REJECTED` style (`bg-red-900/50 text-red-300`). Ensure:

- Rejected attachments display the chip correctly.
- A tooltip/title on the chip reads `"File rejected: possible malware detected"`.
- The download/open button is hidden for `REJECTED` attachments.

---

## Files

| Path | Change |
|---|---|
| `docker-compose.yml` | Add `clamav` service + `clamav_db` volume |
| `docker-compose.prod.yml` | Add `clamav` service + `clamav_db` volume |
| `server/config/env.ts` | Add `CLAMAV_HOST`, `CLAMAV_PORT` |
| `server/extensions/attachment/mods/virusScan/clamav.ts` | New — ClamAV INSTREAM scanner |
| `server/extensions/attachment/mods/virusScan/worker.ts` | Replace VirusTotal stub with ClamAV |
| `server/extensions/attachment/mods/virusScan/enqueue.ts` | Forward `s3Key` in queue message |
| `src/extensions/Attachments/components/AttachmentItem.tsx` | Tooltip + hide download on REJECTED |
| `tests/integration/attachment/virusScan.test.ts` | New — EICAR + clean file + fail-open tests |

---

## Acceptance Criteria

- [ ] Uploading an EICAR test file results in `status: REJECTED`
- [ ] Uploading a normal file results in `status: READY`
- [ ] `REJECTED` attachment shows red chip with tooltip; download button is hidden
- [ ] When `VIRUS_SCAN_ENABLED=false`, attachment is immediately `READY` (existing behaviour, no regression)
- [ ] ClamAV unreachable → fail-open → `READY` (never blocks uploads indefinitely)
- [ ] Virus definitions persist in a named Docker volume across restarts
- [ ] No external API key required
