// Resume — resumes a failed edit run from the last successful step.
// [why] When a step fails (e.g. commit push fails, file write fails),
// the run transitions to FAILED. Resume finds the last successful step
// and re-runs only the remaining steps, skipping already-completed ones.
import { getEditRun, getEditSteps } from '../persistence';
import { EditRunStatus, MAX_RETRY_ATTEMPTS } from '../../common/config';
import type { EditRun, EditStep, ResumeInput, ResumeResult } from '../../types';

export const resumeDeps = {
  getEditRun,
  getEditSteps,
};

/**
 * Find the last step whose status is SUCCEEDED for a failed run.
 * Returns the step name of the last successful step, or null if none succeeded.
 */
export function findLastSuccessfulStep(steps: EditStep[]): string | null {
  // [why] Steps are ordered by created_at ascending
  const succeeded = steps
    .filter(s => s.status === 'SUCCEEDED')
    .slice(-1);
  return succeeded.length > 0 ? succeeded[0].step_name : null;
}

/**
 * Determine which pipeline steps still need to be executed.
 * Returns the list of step names that come after the last successful step.
 */
export function getRemainingSteps(
  steps: EditStep[],
  lastSuccessfulStep: string | null,
): string[] {
  const pipelineOrder = [
    'context_gather',
    'file_scope_plan',
    'files_create',
    'files_edit',
    'commit',
  ];

  if (!lastSuccessfulStep) {
    // No step succeeded — restart from the beginning
    return pipelineOrder;
  }

  const lastIdx = pipelineOrder.indexOf(lastSuccessfulStep);
  if (lastIdx === -1) return pipelineOrder;

  return pipelineOrder.slice(lastIdx + 1);
}

/**
 * Check if a step should be retried based on attempt count.
 * [why] Steps that have exceeded MAX_RETRY_ATTEMPTS are not retried;
 * the run remains in FAILED state.
 */
export function canRetryStep(
  steps: EditStep[],
  stepName: string,
  maxRetries: number = MAX_RETRY_ATTEMPTS,
): { canRetry: boolean; step?: EditStep } {
  const step = steps.find(s => s.step_name === stepName);
  if (!step) return { canRetry: true }; // Step hasn't been created yet

  if (step.status === 'SUCCEEDED') return { canRetry: false, step }; // Already done
  if (step.status === 'FAILED' && step.attempt >= maxRetries) {
    return { canRetry: false, step }; // Max retries exhausted
  }

  return { canRetry: true, step };
}

/**
 * Resume a failed run: find the last successful step, determine remaining steps,
 * and validate that retry limits haven't been exhausted.
 *
 * [why] This is a read-only validation function — the actual re-execution
 * is handled by the orchestrator pipeline, which reads the same steps
 * and runs only the remaining ones.
 */
export async function resumeRun({
  runId,
  maxRetries = MAX_RETRY_ATTEMPTS,
}: ResumeInput): Promise<ResumeResult> {
  // 1. Load the run
  const run = await resumeDeps.getEditRun(runId);
  if (!run) {
    return {
      status: 404,
      name: 'run-not-found',
      message: `Edit run "${runId}" not found`,
    };
  }

  // 2. Only FAILED runs can be resumed
  if (run.status !== EditRunStatus.FAILED) {
    return {
      status: 409,
      name: 'cannot-resume-non-failed-run',
      data: { run, steps: [] },
      message: `Run "${runId}" is in status "${run.status}" — only FAILED runs can be resumed`,
    };
  }

  // 3. Load all steps for this run
  const steps = await resumeDeps.getEditSteps(runId);

  // 4. Find the last successful step
  const lastSuccessful = findLastSuccessfulStep(steps);

  // 5. Determine remaining steps
  const remainingSteps = getRemainingSteps(steps, lastSuccessful);
  if (remainingSteps.length === 0) {
    return {
      status: 409,
      name: 'no-remaining-steps',
      data: { run, steps },
      message: 'No remaining steps to execute — all steps completed',
    };
  }

  // 6. Check retry limits
  const exhaustedSteps: string[] = [];
  for (const stepName of remainingSteps) {
    const { canRetry, step } = canRetryStep(steps, stepName, maxRetries);
    if (!canRetry && step) {
      exhaustedSteps.push(`${stepName} (${step.attempt}/${maxRetries} attempts)`);
    }
  }

  if (exhaustedSteps.length > 0) {
    return {
      status: 409,
      name: 'max-retries-exhausted',
      data: { run, steps },
      message: `Cannot resume — max retries exhausted for: [${exhaustedSteps.join(', ')}]`,
    };
  }

  // 7. Return the run and steps for the orchestrator to re-execute
  return {
    status: 200,
    data: { run, steps },
    message: lastSuccessful
      ? `Resuming from "${lastSuccessful}" — remaining: [${remainingSteps.join(', ')}]`
      : 'Starting from beginning — no steps completed',
  };
}
