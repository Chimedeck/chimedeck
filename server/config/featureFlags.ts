export const featureFlags = {
  // [context] Read at access-time so runtime env toggles are reflected immediately by route guards.
  get STATE_TRANSITIONS_ENABLED() {
    return Bun.env.STATE_TRANSITIONS_ENABLED === 'true';
  },
  // [context] Master switch for workspace subscription/billing UI and gating.
  // When false, the Billing tab is hidden and subscription features resolve to the unlimited tier.
  get SUBSCRIPTIONS_ENABLED() {
    return Bun.env['SUBSCRIPTIONS_ENABLED'] === 'true';
  },
  // [context] Master switch for the agentic workflow pipeline (inner card chat,
  // phase triggers, AI context, AI editing, sprint generation, as-built sync).
  // When false, all agentic features are hidden and their APIs return 404.
  get AGENTIC_WORKFLOW_ENABLED() {
    return Bun.env['AGENTIC_WORKFLOW_ENABLED'] === 'true';
  },
  // [context] Per-feature switch for AI Context gathering (gather + file-scope).
  // Independent of AGENTIC_WORKFLOW_ENABLED for fine-grained control.
  get AI_CONTEXT_ENABLED() {
    return Bun.env['AI_CONTEXT_ENABLED'] === 'true';
  },
  // [context] Per-feature switch for AI Edit Orchestrator (Sprint 175).
  // Independent of AGENTIC_WORKFLOW_ENABLED for fine-grained control.
  get AI_EDIT_ENABLED() {
    return Bun.env['AI_EDIT_ENABLED'] === 'true';
  },
  // [context] Per-feature switch for Sprint Generation pipeline (Sprint 176).
  // Independent of AGENTIC_WORKFLOW_ENABLED for fine-grained control.
  get SPRINT_GENERATION_ENABLED() {
    return Bun.env['SPRINT_GENERATION_ENABLED'] === 'true';
  },
} as const;
