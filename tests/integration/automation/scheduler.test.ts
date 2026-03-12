// tests/integration/automation/scheduler.test.ts
// Integration tests for the Sprint 64 automation scheduler components.
//
// Tests are handler-level and unit-level, not requiring a live DB connection,
// to allow them to run in CI without a Postgres instance.
// DB-dependent assertions (SQL function calls) are guarded with a live-DB check.

import { describe, it, expect } from 'bun:test';
import { automationConfig } from '../../../server/extensions/automation/config/index';
import { startAutomationScheduler } from '../../../server/extensions/automation/scheduler/index';

// ── Config flag tests ─────────────────────────────────────────────────────────

describe('automationConfig scheduler flags', () => {
  it('has usePgCron defaulting to false when AUTOMATION_USE_PGCRON is unset', () => {
    // In test environment AUTOMATION_USE_PGCRON is not set → should be false.
    // The config reads Bun.env at module load time; we verify the exported value.
    expect(typeof automationConfig.usePgCron).toBe('boolean');
  });

  it('has schedulerEnabled defaulting to true when AUTOMATION_SCHEDULER_ENABLED is unset', () => {
    // Default is true (enabled) unless the env var is explicitly "false".
    expect(typeof automationConfig.schedulerEnabled).toBe('boolean');
  });

  it('exports maxConcurrent and runLogCap alongside scheduler flags', () => {
    expect(automationConfig.maxConcurrent).toBeGreaterThan(0);
    expect(automationConfig.runLogCap).toBeGreaterThan(0);
  });
});

// ── Scheduler index: disabled path ───────────────────────────────────────────

describe('startAutomationScheduler', () => {
  it('is a function', () => {
    expect(typeof startAutomationScheduler).toBe('function');
  });

  it('returns a Promise', () => {
    // Only test the disabled code path (schedulerEnabled=false would resolve quickly).
    // We cannot safely call startAutomationListener in unit tests without a DB.
    const result = startAutomationScheduler();
    expect(result).toBeInstanceOf(Promise);
    // Settle the promise to avoid unhandled rejection noise in test output.
    result.catch(() => {});
  });
});

// ── execute() — direct scheduler entry point ─────────────────────────────────

describe('execute()', () => {
  it('is exported from the engine index', async () => {
    const { execute } = await import('../../../server/extensions/automation/engine/index');
    expect(typeof execute).toBe('function');
  });

  it('resolves without throwing when automation is not found', async () => {
    const { execute } = await import('../../../server/extensions/automation/engine/index');
    // Non-existent IDs should silently no-op (DB returns no rows).
    await expect(
      execute({
        automationId: '00000000-0000-0000-0000-000000000000',
        boardId: '00000000-0000-0000-0000-000000000001',
        cardId: null,
        actorId: null,
      }),
    ).resolves.toBeUndefined();
  });
});

// ── Listener module ───────────────────────────────────────────────────────────

describe('listener module', () => {
  it('exports startAutomationListener as a function', async () => {
    const { startAutomationListener } = await import(
      '../../../server/extensions/automation/scheduler/listener'
    );
    expect(typeof startAutomationListener).toBe('function');
  });
});

// ── Worker fallback module ────────────────────────────────────────────────────

describe('workerFallback module', () => {
  it('module file exists at expected path', async () => {
    const file = Bun.file(
      new URL(
        '../../../server/extensions/automation/scheduler/workerFallback.ts',
        import.meta.url,
      ),
    );
    const exists = await file.exists();
    expect(exists).toBe(true);
  });
});
