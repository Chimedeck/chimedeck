# ChimeDeck Security Audits

This folder contains audit-only deliverables for multi-tenancy, API authorization, and data isolation risks mapped for remediation planning.

Mandatory rule for all related sprints:

- NO CODE should be created.
- ONLY CREATE AUDIT DOCUMENT.

## Audit Index and Severity Alignment

| Audit file | Severity | Focus summary | OWASP Top 10 2026 focus |
| --- | --- | --- | --- |
| `cross-tenant-board-idor.md` | High | Cross-tenant board object access via IDOR-style identifier swapping. | A01 Broken Access Control |
| `cross-tenant-card-idor.md` | Critical | Cross-tenant card read/mutation exposure through weak object authorization. | A01 Broken Access Control |
| `invitation-token-cross-tenant-confusion.md` | High | Invitation token redemption across tenant boundaries due to weak context binding. | A01 Broken Access Control, A07 Identification and Authentication Failures |
| `missing-object-level-authorization-on-board-members-api.md` | Critical | Board-members API allows unauthorized member/role mutation on foreign boards. | A01 Broken Access Control |
| `api-token-overbroad-scope-and-horizontal-privilege-escalation.md` | High | API token scope overreach enables horizontal privilege escalation across workspaces. | A01 Broken Access Control, A07 Identification and Authentication Failures |
| `search-index-cross-workspace-data-leak.md` | High | Search index responses leak cross-workspace entities without hard tenant filtering. | A01 Broken Access Control |
| `websocket-room-subscription-tenant-escape.md` | Critical | Websocket room subscription bypass exposes foreign-tenant realtime activity. | A01 Broken Access Control |
| `plugin-data-cross-board-isolation-break.md` | High | Plugin data scope checks allow cross-board read/write isolation break. | A01 Broken Access Control, A04 Insecure Design |
| `cross-tenant-comment-and-attachment-enumeration.md` | Medium | Comment/attachment enumeration leaks metadata or content across tenant boundaries. | A01 Broken Access Control, A02 Cryptographic Failures |

## Severity Snapshot

- Critical: 3
- High: 5
- Medium: 1
- Low: 0
- Warning: 0

Severity assignment is aligned to OWASP Top 10 2026 risk framing:
- **A01 Broken Access Control** is the primary class across all cross-tenant object, membership, search, realtime, and scoped-resource leaks.
- **A07 Identification and Authentication Failures** applies where invitation or API token identity context is accepted without strict tenant binding.
- **A04 Insecure Design** and **A02 Cryptographic Failures** are secondary contributors where plugin/attachment scoping controls allow isolation bypass.

## Required Audit File Section Format

Each loophole audit file must include exactly these sections:

- Serveriy (Critical, High, Medium, Low, Warning)
- Explainnation on the impact
- How to actually exploit the loop hole
- Step by step hypothesis to re-produce the loop whole
