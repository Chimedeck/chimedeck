// Dead-letter log for trigger runs that exhaust all retry attempts.
// Stores final failure details in-memory with console.error for now;
// durable persistence to a DB table deferred to Sprint 174.

export interface DeadLetterEntry {
  runId: string;
  phase: string;
  cardId: string;
  boardId: string;
  attempts: number;
  lastError: string | null;
  timestamp: string;
}

const deadLetterLog: DeadLetterEntry[] = [];

export const deadLetterDeps = {
  /** Maximum entries to keep in memory before pruning oldest. */
  maxEntries: 1000,
};

/**
 * Log a trigger run that has exhausted all retry attempts.
 */
export function logDeadLetter({
  runId,
  phase,
  cardId,
  boardId,
  attempts,
  lastError,
}: {
  runId: string;
  phase: string;
  cardId: string;
  boardId: string;
  attempts: number;
  lastError: string | null;
}): void {
  const entry: DeadLetterEntry = {
    runId,
    phase,
    cardId,
    boardId,
    attempts,
    lastError,
    timestamp: new Date().toISOString(),
  };

  deadLetterLog.push(entry);

  // Prune oldest if over max entries
  while (deadLetterLog.length > deadLetterDeps.maxEntries) {
    deadLetterLog.shift();
  }

  console.error(
    `[triggers/deadLetter] Run ${runId} exhausted ${attempts} attempts for phase "${phase}" on card ${cardId}: ${lastError ?? 'unknown error'}`,
  );
}

/**
 * Retrieve all dead-letter entries (for admin/debugging purposes).
 */
export function getDeadLetterLog(): ReadonlyArray<DeadLetterEntry> {
  return deadLetterLog;
}

/**
 * Clear the dead-letter log.
 */
export function clearDeadLetterLog(): void {
  deadLetterLog.length = 0;
}
