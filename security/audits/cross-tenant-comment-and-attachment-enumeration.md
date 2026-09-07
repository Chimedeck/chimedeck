# cross-tenant-comment-and-attachment-enumeration

## Serveriy (Critical, High, Medium, Low, Warning)

Medium

## Explainnation on the impact

If comment and attachment identifiers are enumerable (predictable IDs, sequential ranges, reusable signed references) and read/download endpoints do not consistently enforce workspace + board authorization, an attacker can discover and access foreign tenant artifacts. Exposure can include comment content, attachment filenames, MIME types, uploader identity, timestamps, and binary file data. Even where direct content is blocked, response-code/body/timing differences still leak object existence and enable targeted follow-on attacks.

Requirement/spec mapping: this violates access boundaries in `specs/architecture/requirements.md` (guests and members can access only granted boards), permission correctness guarantees in `specs/architecture/architecture.md`, and attachment handling expectations tied to signed URL protection and board-scoped authorization.

## How to actually exploit the loop hole

1. Authenticate as a low-privilege user in Tenant/Workspace A with access to only one board.
2. Capture legitimate comment and attachment request patterns (view, metadata, and file download/signing endpoints).
3. Infer identifier format and generate adjacent/candidate IDs.
4. Replay requests with candidate IDs that are likely to belong to foreign boards or tenants.
5. Compare responses for metadata disclosure, file delivery, or existence side channels (status/body/timing differences).

## Step by step hypothesis to re-produce the loop whole

1. Create Workspace A and Workspace B with no shared members; in Workspace B create comments and attachments containing unique marker strings.
2. Sign in as a low-privilege user with access only to Workspace A board.
3. Capture valid Workspace A requests for comment detail/list, attachment metadata, and signed-download generation.
4. Derive candidate foreign identifiers from observed format (adjacent IDs, prefix ranges, and randomized nearby probes).
5. Replay comment endpoints with candidate IDs and record status/body/timing differences.
6. Replay attachment metadata and signed-download endpoints with the same IDs and record differences.
7. Confirm confidentiality leak if Workspace B marker text, filenames, uploader IDs, MIME types, or file bytes are returned.
8. Confirm enumeration leak even without direct data if error/latency signatures reliably distinguish "exists but forbidden" from "not found," then document affected routes and authentication paths.

## Validation result

- Checked with script: `security/scripts/check-cross-tenant-comment-attachment-enumeration.ts`
- Checked at: `2026-05-06T03:05:06.208Z`
- Base URL: `http://localhost:3000`
- Admin account: `admin-email@email.com`
- Normal account: `replace-test-email@email.com`
- Pristine account: `replace-test-email+test@email.com`
- Forbidden board short ID: `7WlfAtA7`
- Forbidden card short ID: `QqOnIdEz`
- Admin control checks:
	- Board read -> `200`
	- Card read -> `200`
	- Card comments list -> `200` (`16` comments)
	- Card attachments list -> `200` (`0` attachments)

- Normal account (`replace-test-email@email.com`):
	- Baseline forbidden board/card reads -> `403` / `403`
	- Forbidden card comments list -> `403`
	- Forbidden card attachments list -> `403`
	- Comment replies endpoint with known existing forbidden comment ID (`67ef47f32b204ec8a03a9b28`) -> `200`
	- Comment replies endpoint with random non-existing comment ID -> `404`
	- Distinguishable existence side-channel: `true`

- Pristine account (`replace-test-email+test@email.com`):
	- Baseline forbidden board/card reads -> `403` / `403`
	- Forbidden card comments list -> `403`
	- Forbidden card attachments list -> `403`
	- Comment replies endpoint with known existing forbidden comment ID (`67ef47f32b204ec8a03a9b28`) -> `200`
	- Comment replies endpoint with random non-existing comment ID -> `404`
	- Distinguishable existence side-channel: `true`

- Attachment direct-ID probe limitation:
	- No attachment IDs available on target card (`attachmentCount = 0`), so existing-vs-random attachment view comparison could not be executed in this run.

- Script verdict: `vulnerable = true`

## Conclusion

This scenario is **reproducible** in current environment due to the comment-replies path. Both normal and pristine unauthorized accounts received `200` for replies on a known existing forbidden comment ID while receiving `404` on random IDs, confirming both unauthorized data exposure and a reliable enumeration side-channel (`exists/forbidden` distinguishability).

Attachment enumeration remains **inconclusive for direct existing-ID comparison** in this run because the target card had no attachments.
