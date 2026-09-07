# Pull-request review checklist

Use this checklist to decide whether a feature pull request is ready to merge. It supplements the agent-loop and sprint instructions in `CONTRIBUTING.md`; it does not replace product-specific acceptance criteria.

## Reviewer decision

Choose exactly one outcome:

- **APPROVE** — every required acceptance criterion has evidence and no material scope, security or documentation gap remains.
- **REQUEST CHANGES** — the pull request is reviewable but a required criterion, test, documentation surface, permission boundary or scope item is missing.
- **BLOCKED** — an external dependency or failing baseline gate prevents an honest decision. State the blocker, owner and next verification step.

Do not approve conditionally. Required follow-up belongs in this pull request or a separately approved, linked change request.

## 1. Scope and traceability

- [ ] The PR links its source of authority: sprint, issue, Chimedeck card, spec or approved change request.
- [ ] Every acceptance criterion is observable and has a result or evidence reference.
- [ ] The changed files match the claimed scope; unrelated refactors, generated output and local artefacts are excluded.
- [ ] Deferred work is explicit and linked, not hidden in review comments.

## 2. Behaviour and proof

- [ ] Focused automated tests cover the changed behaviour, including one failure/denial path where applicable.
- [ ] API, database, auth or realtime changes have proof through the real affected boundary, not only a helper mock.
- [ ] UI changes have browser/Playwright proof of the user-visible happy path and an error/edge case.
- [ ] The stated commands, results and environment are included in the PR description.

## 3. Documentation surfaces

- [ ] User-facing, developer-facing and operator-facing documentation affected by the capability are updated.
- [ ] Public API/MCP/CLI changes update every relevant catalogue, reference page, parameter detail and example/scenario.
- [ ] For MCP capabilities, check both `server/extensions/mcp/README.md` and the in-product `/developer/mcp` Developer Docs page.
- [ ] Changelog/spec/sprint records are updated when the change is more than a trivial correction.

## 4. Security and authority

- [ ] The change reuses or strengthens the existing authentication and authorisation boundary; no privileged bypass was added.
- [ ] Inputs are validated and errors are structured, bounded and safe to expose.
- [ ] Secrets, tokens, customer data and generated credentials are not committed or logged.
- [ ] Side effects (production deploys, payments, irreversible data changes) have the required human approval and evidence.

## 5. Validation honesty

Record every required gate as one of:

| Status                     | Meaning                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PASS`                     | Command ran in the stated environment and passed.                                                                                                                                    |
| `FAIL`                     | Command ran and failed; merge is not approved without disposition.                                                                                                                   |
| `BLOCKED — known baseline` | The command cannot provide a green gate because of pre-existing failures. Link the issue/evidence, show the failure is unrelated, and provide the strongest focused proof available. |

A passing focused test does not make a failing full suite green. A known baseline failure must not be described as simply “tests passed”.

## 6. Merge checklist

- [ ] Reviewer outcome is recorded in the PR.
- [ ] Required review comments are resolved or converted into an explicit linked follow-up.
- [ ] Branch is current with the intended base and CI status is understood.
- [ ] The PR has an owner for deployment/UAT where those gates are required.
