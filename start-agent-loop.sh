#!/bin/bash

# =============================================================================
# Agent Loop – GitHub Copilot phased iteration runner
#
# Usage:
#   bash start-agent-loop.sh [--no-guardrails] "Task description"
#
# Workflow per iteration:  Recap → Planning → (approval gate) → Execute → Retest
# Scope per iteration:     1 standalone feature  OR  2 intertwined features
#
# Guardrails (on by default, disable with --no-guardrails / -y):
#   • New project  – runs Recap + Planning only on iteration 1, generates an
#                    architecture doc, then pauses for human review before
#                    any code is written.
#   • Every iter   – pauses after Planning and asks for human approval before
#                    Execute runs.
#
# Model assignment
#   Recap    – claude-haiku-4-5   (free / fast – just reading state)
#   Planning – claude-sonnet-4-6  (most capable – architecture decisions)
#   Execute  – claude-sonnet-4-5  (premium – solid implementation)
#   Retest   – claude-haiku-4-5 + gpt-4.1  (free scout + GPT-4.1 evaluator)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
GUARDRAILS=true
POSITIONAL_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --no-guardrails|-y)
      GUARDRAILS=false
      ;;
    *)
      POSITIONAL_ARGS+=("$arg")
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Config – edit these before running
# ---------------------------------------------------------------------------
MAX_ITERATIONS=10
TASK_DESCRIPTION="${POSITIONAL_ARGS[0]:-"Build features according to spec.md"}"
WORKFLOW_FILE=".github/copilot-instructions.md"
SAMPLE_PROJECT_DIR="sample-project"  # read-only reference repo cloned by setup.sh
CHANGELOG_DIR="specs/changelog"       # one timestamped .md per iteration
ARCH_DIR="specs/architecture"          # architecture decision records

# Model identifiers (as accepted by the GitHub Copilot CLI --model flag)
MODEL_RECAP="claude-haiku-4-5"
MODEL_PLAN="claude-sonnet-4-6"
MODEL_EXECUTE="claude-sonnet-4-5"
MODEL_TEST_FREE="claude-haiku-4-5"
MODEL_TEST_EVAL="gpt-4.1"

# Temp directory for inter-phase context passing
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
phase_header() {
  local phase="$1" model="$2"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  [Iter ${CURRENT_ITER}/${MAX_ITERATIONS}] Phase: ${phase}"
  echo "  Model : ${model}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

run_copilot() {
  local model="$1"
  local prompt="$2"
  local out_file="$3"

  copilot \
    --model "$model" \
    --allow-all-tools \
    -p "$prompt" \
    | tee "$out_file"
}

# Returns 0 (true) if the project is still in its initial/architecture phase.
#
# Conditions that indicate an immature architecture:
#   1. specs/architecture/architecture.md does not exist yet.
#   2. architecture.md exists but contains fewer than 30 non-blank lines,
#      meaning it is a stub rather than a real design document.
#   3. No architecture .md files exist beyond requirements.md (the brief).
#
# requirements.md is intentionally excluded from the count — it is the
# project brief written by the human, not an architecture decision record.
is_new_project() {
  local arch_file="${ARCH_DIR}/architecture.md"

  # No architecture.md at all → definitely new
  if [[ ! -f "$arch_file" ]]; then
    return 0
  fi

  # architecture.md exists but is a thin stub (< 30 substantive lines)
  local line_count
  line_count=$(grep -cv '^\s*$' "$arch_file" 2>/dev/null || echo 0)
  if [[ "$line_count" -lt 30 ]]; then
    return 0
  fi

  # No other architecture .md files beyond requirements.md and architecture.md
  # (e.g. no feature specs, no ADRs) → still considered initial phase
  local extra_count
  extra_count=$(find "$ARCH_DIR" -maxdepth 1 -name '*.md' \
    ! -name 'requirements.md' \
    ! -name 'architecture.md' \
    2>/dev/null | wc -l | tr -d ' ')
  if [[ "$extra_count" -eq 0 ]]; then
    return 0
  fi

  # Architecture looks sufficiently defined
  return 1
}

# Pauses and asks the human to approve before continuing.
# Returns 0 if approved, 1 if rejected.
ask_approval() {
  local prompt_msg="$1"
  echo ""
  echo "╔══════════════════════════════════════════════════╗"
  echo "║  HUMAN APPROVAL REQUIRED (guardrails are ON)     ║"
  echo "╚══════════════════════════════════════════════════╝"
  echo "$prompt_msg"
  echo ""
  read -r -p "  Continue? [y/N] " answer
  case "$answer" in
    [yY][eE][sS]|[yY]) return 0 ;;
    *) return 1 ;;
  esac
}

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
echo "Starting agent loop: ${MAX_ITERATIONS} iterations"
echo "Task        : ${TASK_DESCRIPTION}"
echo "Guardrails  : ${GUARDRAILS}"
if $GUARDRAILS; then
  echo "  ↳ Agent will pause for human approval after Planning each iteration."
  echo "    Run with --no-guardrails to disable."
fi
echo ""

# On a brand-new project, run Recap + Planning only to generate the
# architecture doc, then wait for human sign-off before anything is built.
if $GUARDRAILS && is_new_project; then
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  INITIAL ARCHITECTURE PHASE DETECTED                        ║"
  echo "║                                                              ║"
  echo "║  Reason (first passing condition):                          ║"
  if [[ ! -f "${ARCH_DIR}/architecture.md" ]]; then
  echo "║  • specs/architecture/architecture.md does not exist yet.   ║"
  elif [[ $(grep -cv '^\s*$' "${ARCH_DIR}/architecture.md" 2>/dev/null || echo 0) -lt 30 ]]; then
  echo "║  • architecture.md exists but is a stub (< 30 lines).       ║"
  else
  echo "║  • No feature specs or ADRs found beyond architecture.md.   ║"
  fi
  echo "║                                                              ║"
  echo "║  Running Recap + Planning to produce an architecture doc.   ║"
  echo "║  No code will be written until you review and approve it.   ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""

  CURRENT_ITER=0
  BOOTSTRAP_RECAP_OUT="${TMP_DIR}/bootstrap_recap.md"
  BOOTSTRAP_PLAN_OUT="${TMP_DIR}/bootstrap_plan.md"

  phase_header "BOOTSTRAP RECAP" "$MODEL_RECAP"
  BOOTSTRAP_RECAP_PROMPT="You are bootstrapping a brand-new project (iteration 0).
Read the workflow instructions in '${WORKFLOW_FILE}' first.
Task: ${TASK_DESCRIPTION}

PROJECT REQUIREMENTS: Read '${ARCH_DIR}/requirements.md' first.
  This file contains the project name, description, key features, integrations,
  constraints, and open questions provided by the project owner.
  Use it as the authoritative source of intent for everything you do.

No architecture specs exist yet in specs/architecture/ (other than requirements.md).
No changelogs exist yet in specs/changelog/.

REFERENCE REPO (read-only): '${SAMPLE_PROJECT_DIR}/'
  - Read relevant files to understand how the upstream template is structured.
  - Do NOT modify, run, or commit anything inside '${SAMPLE_PROJECT_DIR}/'.

Summarise:
- What the task requires at a high level (derive from requirements.md).
- What the upstream template already provides (from ${SAMPLE_PROJECT_DIR}/).
- What will need to be built from scratch.
- Key risks or unknowns before architecture is decided.
Keep to 5-10 bullets. Do NOT write any code."

  run_copilot "$MODEL_RECAP" "$BOOTSTRAP_RECAP_PROMPT" "$BOOTSTRAP_RECAP_OUT"

  phase_header "BOOTSTRAP PLANNING – ARCHITECTURE" "$MODEL_PLAN"
  BOOTSTRAP_RECAP_SUMMARY="$(cat "$BOOTSTRAP_RECAP_OUT")"
  BOOTSTRAP_PLAN_PROMPT="You are in the bootstrap Planning phase for a brand-new project.
Read the workflow instructions in '${WORKFLOW_FILE}' first.

PROJECT REQUIREMENTS: Read '${ARCH_DIR}/requirements.md' — this is the source of
  truth for what needs to be built. Every architectural decision must trace back
  to a requirement in that file. Call out anything that is ambiguous or missing.

Recap:
${BOOTSTRAP_RECAP_SUMMARY}

Overall task: ${TASK_DESCRIPTION}

REFERENCE REPO (read-only): '${SAMPLE_PROJECT_DIR}/'
  - Use it to understand upstream patterns only. Write nothing there.

Your job is to produce the project architecture BEFORE any code is written.
Do two things:

1. Write a full architecture document and save it to
   '${ARCH_DIR}/architecture.md'.
   The document must cover:
   - System overview and goals
   - Client folder structure (following the feature-grouping conventions in
     '${WORKFLOW_FILE}')
   - Server folder structure (same conventions)
   - Key modules and their responsibilities
   - External integrations (if any)
   - Data flow diagram (text-based is fine)
   - Open questions that need human input

2. Produce a high-level iteration roadmap: list the features to build in
   order, one feature per iteration, following the scope constraint of
   max 2 intertwined features per iteration.

Do NOT write any implementation code."

  run_copilot "$MODEL_PLAN" "$BOOTSTRAP_PLAN_PROMPT" "$BOOTSTRAP_PLAN_OUT"

  echo ""
  echo "Architecture document written to ${ARCH_DIR}/architecture.md"
  echo "Please review the file, make any edits you need, then re-run:"
  echo ""
  echo "  bash start-agent-loop.sh \"${TASK_DESCRIPTION}\""
  echo ""
  echo "The loop will detect the architecture doc and proceed to implementation."
  exit 0
fi

for i in $(seq 1 "$MAX_ITERATIONS"); do
  CURRENT_ITER=$i

  RECAP_OUT="${TMP_DIR}/recap_${i}.md"
  PLAN_OUT="${TMP_DIR}/plan_${i}.md"
  EXEC_OUT="${TMP_DIR}/exec_${i}.md"
  TEST_OUT="${TMP_DIR}/test_${i}.md"

  # ── PHASE 1: RECAP ───────────────────────────────────────────────────────
  phase_header "RECAP" "$MODEL_RECAP"

  RECAP_PROMPT="You are in Phase 1 (Recap) of iteration ${i}.
Read the workflow instructions in '${WORKFLOW_FILE}' first.
Task: ${TASK_DESCRIPTION}

SPECS (read these before doing anything else):
  - Requirements       : ${ARCH_DIR}/requirements.md  – the authoritative
    source of what this project must do. Read it on every iteration.
  - Architecture specs : specs/architecture/   – read all .md files here to
    understand the intended system design and constraints.
  - Changelog          : specs/changelog/       – read the most recent entries
    (sort by filename descending) to understand what has already been done,
    what technical debt exists, and what was deferred.

REFERENCE REPO (read-only): '${SAMPLE_PROJECT_DIR}/'
  - Read files inside it to understand how the upstream template handles
    the area you are about to work on.
  - Do NOT modify, run, or commit anything inside '${SAMPLE_PROJECT_DIR}/'.

Summarise in bullet points:
- What has already been implemented in THIS project (check git log / existing files
  and the changelogs in specs/changelog/).
- Any outstanding technical debt or deferred items from previous changelogs.
- How the reference repo in '${SAMPLE_PROJECT_DIR}/' handles the same area (if relevant).
- What still needs to be done to fulfil the task.
- Any blockers or risks.
Keep this concise – 5 to 10 bullets maximum.
Do NOT write any code yet."

  run_copilot "$MODEL_RECAP" "$RECAP_PROMPT" "$RECAP_OUT"

  # ── PHASE 2: PLANNING ────────────────────────────────────────────────────
  phase_header "PLANNING" "$MODEL_PLAN"

  RECAP_SUMMARY="$(cat "$RECAP_OUT")"
  PLAN_PROMPT="You are in Phase 2 (Planning) of iteration ${i}.
Read the workflow instructions in '${WORKFLOW_FILE}' first.

Recap from previous phase:
${RECAP_SUMMARY}

Overall task: ${TASK_DESCRIPTION}

SPECS (consult before writing the plan):
  - Requirements       : ${ARCH_DIR}/requirements.md  – every planned change
    must satisfy a requirement here. Flag if anything contradicts or is
    missing from the requirements.
  - Architecture specs : specs/architecture/   – your plan must align with the
    documented architecture. Flag any deviation as a risk.
  - Changelog          : specs/changelog/       – check deferred items from
    previous iterations; incorporate any that are relevant to this iteration.

REFERENCE REPO (read-only): '${SAMPLE_PROJECT_DIR}/'
  - You may read any file in it to understand patterns, types, or
    component structure from the upstream template.
  - All files you plan to create or modify must be in THIS project, never
    inside '${SAMPLE_PROJECT_DIR}/'.

SCOPE CONSTRAINT (strictly enforced):
- Choose at most 2 intertwined features OR 1 standalone feature for this iteration.
- If more work remains, explicitly defer it and label it 'Next iteration'.

Produce a numbered implementation plan:
1. List every file in THIS project to create or modify.
2. Describe the change for each file in one sentence.
3. Note any pattern borrowed from '${SAMPLE_PROJECT_DIR}/' and how you will adapt it.
4. Note any architecture spec from specs/architecture/ that governs this work.
5. Name the tests that will verify the work.
6. Flag any edge cases or human decisions needed.
Do NOT write any code yet."

  run_copilot "$MODEL_PLAN" "$PLAN_PROMPT" "$PLAN_OUT"

  # ── APPROVAL GATE ────────────────────────────────────────────────────────
  if $GUARDRAILS; then
    PLAN_PREVIEW="$(head -40 "$PLAN_OUT")"
    if ! ask_approval "Review the plan above (full output in ${PLAN_OUT}).\n\nFirst 40 lines:\n${PLAN_PREVIEW}\n\nApprove this plan to proceed to Execute?"; then
      echo ""
      echo "Plan rejected. Agent loop stopped at iteration ${i} by user."
      echo "Edit specs/architecture/ or the task description and re-run."
      exit 1
    fi
  fi

  # ── PHASE 3: EXECUTE ─────────────────────────────────────────────────────
  phase_header "EXECUTE" "$MODEL_EXECUTE"

  PLAN_SUMMARY="$(cat "$PLAN_OUT")"
  EXEC_PROMPT="You are in Phase 3 (Execute) of iteration ${i}.
Read the workflow instructions in '${WORKFLOW_FILE}' first.

Approved plan for this iteration:
${PLAN_SUMMARY}

Overall task: ${TASK_DESCRIPTION}

REFERENCE REPO (read-only): '${SAMPLE_PROJECT_DIR}/'
  - You may read files inside it at any time for reference.
  - Write ALL code changes into THIS project only.
  - Do NOT edit, delete, or stage any file inside '${SAMPLE_PROJECT_DIR}/'.

Implement ONLY what is listed in the plan above – no scope creep.
Follow each numbered step in order.
After finishing all steps, write a short summary of what was changed.
End your response with the token DONE_ALL_TASKS if the entire task is complete."

  run_copilot "$MODEL_EXECUTE" "$EXEC_PROMPT" "$EXEC_OUT"

  # ── PHASE 4: RETEST ──────────────────────────────────────────────────────
  phase_header "RETEST (scout pass)" "$MODEL_TEST_FREE"

  EXEC_SUMMARY="$(cat "$EXEC_OUT")"

  # Scout: decide whether Playwright MCP testing is warranted
  SCOUT_PROMPT="You are in Phase 4 (Retest – scout) of iteration ${i}.
Read the workflow instructions in '${WORKFLOW_FILE}' first.

Changes made this iteration (in THIS project only):
${EXEC_SUMMARY}

Evaluate: does this change require full Playwright MCP browser testing?
Rules from the workflow:
  - SKIP if: pure docs/comments, trivial copy changes, config-only + linter passes.
  - RUN if: any UI change, any API/route change, any auth change, 3+ files touched.

Note: '${SAMPLE_PROJECT_DIR}/' is a read-only reference repo and was NOT changed.
Do not include it in your assessment.

Answer with exactly one of:
  PLAYWRIGHT_REQUIRED
  PLAYWRIGHT_SKIP: <one-line reason>

Then, if PLAYWRIGHT_REQUIRED, list the exact user flows to test (max 5 bullets)."

  SCOUT_OUT="${TMP_DIR}/scout_${i}.txt"
  run_copilot "$MODEL_TEST_FREE" "$SCOUT_PROMPT" "$SCOUT_OUT"

  # Evaluator: run the actual test assessment with GPT-4.1
  if grep -q "PLAYWRIGHT_REQUIRED" "$SCOUT_OUT"; then
    phase_header "RETEST (Playwright MCP evaluation)" "$MODEL_TEST_EVAL"

    SCOUT_SUMMARY="$(cat "$SCOUT_OUT")"
    EVAL_PROMPT="You are in Phase 4 (Retest – Playwright MCP evaluator) of iteration ${i}.
Read the workflow instructions in '${WORKFLOW_FILE}' first.

Scout identified these flows to test:
${SCOUT_SUMMARY}

Changes made this iteration (in THIS project only):
${EXEC_SUMMARY}

IMPORTANT: Run the dev server in THIS project, not in '${SAMPLE_PROJECT_DIR}/'.
'${SAMPLE_PROJECT_DIR}/' is a read-only reference and must not be started or modified.

Use Playwright MCP tools to:
1. Start the dev server in THIS project if not already running.
2. Navigate to each affected view.
3. Execute the happy-path scenario.
4. Execute at least one edge/error scenario.
5. Report PASS or FAIL for each flow with a screenshot reference.
If a test fails, describe the bug clearly so the next iteration can fix it."

    run_copilot "$MODEL_TEST_EVAL" "$EVAL_PROMPT" "$TEST_OUT"
  else
    SKIP_REASON="$(grep 'PLAYWRIGHT_SKIP' "$SCOUT_OUT" || echo 'PLAYWRIGHT_SKIP: trivial change')"
    echo "  ↳ Playwright MCP skipped – ${SKIP_REASON}" | tee "$TEST_OUT"
  fi

  # ── CHANGELOG ────────────────────────────────────────────────────────────
  phase_header "CHANGELOG" "$MODEL_RECAP"

  CHANGELOG_TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
  CHANGELOG_FILE="${CHANGELOG_DIR}/${CHANGELOG_TIMESTAMP}.md"
  mkdir -p "$CHANGELOG_DIR"

  TEST_SUMMARY="$(cat "$TEST_OUT")"
  CHANGELOG_PROMPT="You are writing the changelog for iteration ${i}.

Below is a summary of everything that happened this iteration:

Recap:
$(cat "$RECAP_OUT")

Plan:
$(cat "$PLAN_OUT")

Execution summary:
${EXEC_SUMMARY}

Test results:
${TEST_SUMMARY}

Write a concise changelog entry as a Markdown file with EXACTLY these four sections
(use the headings verbatim):

## Update
List changes made to existing code/features.

## New
List newly added features, files, or capabilities.

## Technical Debt
List shortcuts taken, known issues introduced, or things that should be
revisited. Write 'None' if there is nothing to report.

## What Should Be Done Next
List the next recommended tasks or deferred items from this iteration.

Output ONLY the Markdown content – no preamble, no code fences.
Write the result directly to the file '${CHANGELOG_FILE}'."

  run_copilot "$MODEL_RECAP" "$CHANGELOG_PROMPT" "${TMP_DIR}/changelog_${i}.md"
  echo "  ↳ Changelog written to ${CHANGELOG_FILE}"

  # ── Iteration complete ───────────────────────────────────────────────────
  echo ""
  echo "✓ Iteration ${i} complete."

  # Check if all work is done (Copilot will output DONE_ALL_TASKS when finished)
  if grep -q "DONE_ALL_TASKS" "$EXEC_OUT" 2>/dev/null; then
    echo ""
    echo "All tasks complete – agent loop ending after iteration ${i}."
    break
  fi

  sleep 1
done

echo ""
echo "Agent loop finished after ${i} iteration(s)."