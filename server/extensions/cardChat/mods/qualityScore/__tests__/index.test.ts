// Tests for the deterministic quality score computation.
import { describe, it, expect } from 'vitest';
import { computeQualityScore, QUALITY_THRESHOLD } from '../index';
import type { QualityScoreBreakdown } from '../../../types';

describe('computeQualityScore', () => {
  it('returns zero for empty content', () => {
    const result = computeQualityScore({
      assistantContent: '',
      allUserContent: '',
    });
    expect(result.total).toBe(0);
    expect(result.earsCoverage).toBe(0);
    expect(result.acceptanceCriteria).toBe(0);
    expect(result.constraintClarity).toBe(0);
    expect(result.testability).toBe(0);
    expect(result.ambiguityPenalty).toBe(0);
  });

  it('detects EARS-style requirement signals in assistant output', () => {
    const result = computeQualityScore({
      assistantContent:
        'The system shall allow users to log in. While the user is unauthenticated, the system shall display a login prompt.',
      allUserContent: '',
    });
    expect(result.earsCoverage).toBeGreaterThan(0);
    // "shall", "while", "the system" = 3/6 signals
    expect(result.earsCoverage).toBe(13);
  });

  it('detects acceptance criteria signals', () => {
    const result = computeQualityScore({
      assistantContent:
        'Given a valid email, when the user clicks login, then the system should authenticate and redirect.',
      allUserContent: '',
    });
    expect(result.acceptanceCriteria).toBeGreaterThan(0);
    // "given", "then", "should", "expected" = at least 4/7
    expect(result.acceptanceCriteria).toBeGreaterThanOrEqual(14);
  });

  it('detects constraint signals', () => {
    const result = computeQualityScore({
      assistantContent:
        'Constraint: Must work offline. Assumption: The device has local storage. Non-goal: Real-time sync. Out of scope: Push notifications.',
      allUserContent: '',
    });
    expect(result.constraintClarity).toBeGreaterThan(0);
  });

  it('detects testability signals', () => {
    const result = computeQualityScore({
      assistantContent:
        'To test this, verify the login flow with valid credentials. Validate the error message appears. Confirm the redirect to dashboard. Ensure the session persists.',
      allUserContent: '',
    });
    expect(result.testability).toBeGreaterThan(0);
    // "test", "verify", "validate", "confirm", "ensure" = 5/6
  });

  it('penalizes ambiguous language in assistant output', () => {
    const result = computeQualityScore({
      assistantContent:
        'This should probably be a simple quick fix. It is mostly obvious and should be easy to implement soon.',
      allUserContent: '',
    });
    // Multiple ambiguity signals: "probably", "simple", "quick", "mostly", "obvious", "soon", "should be easy"
    expect(result.ambiguityPenalty).toBeGreaterThan(0);
    expect(result.ambiguityPenalty).toBeLessThanOrEqual(10);
  });

  it('scores user-provided content for structure signals', () => {
    const result = computeQualityScore({
      assistantContent: 'The requirement looks good.',
      allUserContent:
        'The system shall authenticate users via OAuth. While logged out, the system must redirect to login.',
    });
    // User content has "shall", "while", "must", "the system"
    expect(result.earsCoverage).toBeGreaterThan(0);
  });

  it('does not penalize ambiguity in user content', () => {
    // [why] User answers may contain casual language; only assistant output triggers penalty.
    const result = computeQualityScore({
      assistantContent:
        'The system shall validate input on submit. Given valid input, then the system should persist data.',
      allUserContent:
        'I think we should probably just make it simple and quick. It should be mostly obvious.',
    });
    // "probably", "simple", "quick" are in user content — should NOT contribute to penalty.
    // Assistant content has no ambiguity words.
    expect(result.ambiguityPenalty).toBe(0);
  });

  it('produces a high score for comprehensive content', () => {
    const result = computeQualityScore({
      assistantContent: [
        'The system shall allow users to create accounts with email and password.',
        'While the email is unverified, the system shall restrict access to read-only mode.',
        'Given a valid email and password, when the user clicks register, then the system should create an account and send a verification email.',
        'Given an already-registered email, when the user attempts to register, then the system should display "email already in use" and not create a duplicate.',
        'Constraint: Must comply with GDPR. Assumption: SMTP is configured. Non-goal: Social login at this stage. Dependency: Email delivery service.',
        'Test scenario 1: Verify registration with valid data. Test scenario 2: Validate error on duplicate email. Test scenario 3: Confirm verification email is sent. Test scenario 4: Verify unverified email restricts access.',
      ].join('\n'),
      allUserContent:
        'We need registration with email/password. Users should verify their email before full access.',
    });
    expect(result.total).toBeGreaterThanOrEqual(70);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('clamps total score to 0-100 range', () => {
    const result = computeQualityScore({
      assistantContent: '',
      allUserContent: '',
    });
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('returns correct breakdown shape', () => {
    const result = computeQualityScore({
      assistantContent: 'A test requirement.',
      allUserContent: 'Some context.',
    });
    const keys: Array<keyof QualityScoreBreakdown> = [
      'earsCoverage',
      'acceptanceCriteria',
      'constraintClarity',
      'testability',
      'ambiguityPenalty',
      'total',
    ];
    for (const key of keys) {
      expect(typeof result[key]).toBe('number');
    }
  });

  it('QUALITY_THRESHOLD is 90', () => {
    expect(QUALITY_THRESHOLD).toBe(90);
  });
});
