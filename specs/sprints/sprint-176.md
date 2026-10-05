# Sprint 176 - Requirement-to-Sprint Generation and As-Built Sync

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 171 (Inner Card Chat + AI Assist Refinement Loop), Sprint 173 (Metadata Trigger Engine for Card Move Lifecycle), Sprint 175 (Multi-Turn AI Editing Orchestrator for Specs Repo), Sprint 159 (Subscriptions: Tier Entitlements Config + Resolver)
> **Status:** ⬜ Future

---

## Goal

Generate implementation sprints from refined requirements when cards enter Generate Sprint phase columns, and perform final as-built documentation sync when cards enter Update As Built columns.

---

## Strict Boundary

1. This sprint consumes refined requirements as input and emits sprint artifacts.
2. This sprint must enforce tier-aware limits for generation depth and volume.
3. This sprint does not replace manual sprint planning; it augments it with generated drafts.

---

## Scope

### 1. Sprint Generation Trigger Pipeline

When destination column includes `GENERATE_SPRINT`:

- read latest refined requirement packet from card
- read impacted docs from context snapshot
- generate sprint artifacts:
  - update `specs/sprints/sprint-plan.md`
  - create one or more `specs/sprints/sprint-<n>.md`
  - create/update `specs/request_changelog/*.md`

### 2. Service Tier Aware Generation Policy

Tier policy examples:

- lower tiers: limited generated sprint count per request
- higher tiers: full multi-sprint decomposition with dependency graph
- optional advanced outputs on higher tiers:
  - test matrix expansion
  - risk register sections
  - architecture delta summary

### 3. Sprint Card Creation in Board

Create child sprint cards linked to feature card:

- one card per generated sprint
- inherit trace links to specs files and originating feature card
- place cards into configured execution column

### 4. Update As Built Trigger

When destination column includes `UPDATE_AS_BUILT`:

- collect implementation evidence (merged PR refs, changed files, test evidence)
- update architecture/security docs and request changelog
- commit as-built updates through orchestrator flow

### 5. Traceability and Review UX

- show generated file diff summary in card activity
- provide approve/edit/re-run controls before final commit where configured
- add links from card to generated sprint docs and commits

---

## Deliverables

1. Generate Sprint phase execution that writes sprint artifacts and creates sprint cards.
2. Tier-aware generation-depth controls and quota enforcement.
3. Update As Built phase execution for final documentation sync.
4. End-to-end traceability between feature card, generated sprints, files, and commits.
5. Review and approval UX for generated outputs.

---

## Acceptance Criteria

1. Moving a refined card into a Generate Sprint phase column creates sprint docs and child sprint cards.
2. Generated sprint docs include dependencies, acceptance criteria, and test sections.
3. Tier policy is enforced consistently for generation count and advanced outputs.
4. Moving completed work into Update As Built phase updates architecture/security/changelog docs and commits changes.
5. All generated artifacts are linked back to originating feature card and trigger run id.
