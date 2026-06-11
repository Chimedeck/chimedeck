import { describe, it, expect } from 'vitest';
import {
  extractStructuredFields,
  hasAnyStructuredContent,
  formatStructuredBlock,
  type CardRequirementFields,
} from '../structuredExtraction';

describe('extractStructuredFields', () => {
  it('extracts all five field categories from a comprehensive response', () => {
    const text = [
      'Here is the refined summary:',
      '',
      '**Business Value**',
      'This feature solves the onboarding friction for new users by eliminating manual data entry. Key stakeholders include the growth team.',
      '',
      '**EARS Requirements**',
      '1. The system shall auto-populate profile fields from the SSO provider.',
      '2. When the user completes onboarding, the system shall redirect to the dashboard.',
      '',
      '**Acceptance Criteria**',
      '- Given a new SSO user, when they sign up, then their profile is pre-filled.',
      '- Given an existing user, when they re-authenticate, then no duplicate is created.',
      '',
      '**Constraints**',
      'Must work with Azure AD and Google SSO. Out of scope: custom SAML providers.',
      'Depends on the identity service migration completing first.',
    ].join('\n');

    const fields = extractStructuredFields(text);

    expect(fields.business_value).toContain('onboarding friction');
    expect(fields.business_value).toContain('growth team');
    expect(fields.ears_requirements).toContain('system shall auto-populate');
    expect(fields.ears_requirements).toContain('system shall redirect');
    expect(fields.acceptance_criteria).toContain('Given a new SSO user');
    expect(fields.acceptance_criteria).toContain('no duplicate is created');
    expect(fields.constraints).toContain('Azure AD');
    expect(fields.constraints).toContain('Out of scope');
  });

  it('extracts fields with alternative heading patterns', () => {
    const text = [
      '**Business Outcome**',
      'Increased user retention by 15%',
      '',
      '**Requirements**',
      'The system shall log every authentication attempt.',
      '',
      '**Test Scenarios**',
      '1. Successful login with valid credentials',
      '2. Failed login with expired token',
      '',
      '**Non-Goals**',
      'Biometric auth is not in scope for v1.',
      '',
      '**Assumptions**',
      'The auth service is available 24/7.',
    ].join('\n');

    const fields = extractStructuredFields(text);

    expect(fields.business_value).toContain('user retention');
    expect(fields.ears_requirements).toContain('system shall log');
    expect(fields.acceptance_criteria).toContain('Successful login');
    expect(fields.constraints).toContain('Biometric auth');
  });

  it('returns null for all fields when text is empty', () => {
    const fields = extractStructuredFields('');
    expect(fields.business_value).toBeNull();
    expect(fields.ears_requirements).toBeNull();
    expect(fields.acceptance_criteria).toBeNull();
    expect(fields.constraints).toBeNull();
  });

  it('returns null for fields not present in the response', () => {
    const text = [
      '**Business Value**',
      'This feature will save time.',
    ].join('\n');

    const fields = extractStructuredFields(text);

    expect(fields.business_value).toContain('save time');
    expect(fields.ears_requirements).toBeNull();
    expect(fields.acceptance_criteria).toBeNull();
    expect(fields.constraints).toBeNull();
  });

  it('handles partial extraction gracefully when only some fields exist', () => {
    const text = [
      '**Business Value**',
      'Improve dashboard load performance.',
      '',
      '**Acceptance Criteria**',
      '- Page loads under 2 seconds with 10K cards.',
    ].join('\n');

    const fields = extractStructuredFields(text);

    expect(fields.business_value).toBeTruthy();
    expect(fields.ears_requirements).toBeNull();
    expect(fields.acceptance_criteria).toBeTruthy();
    expect(fields.constraints).toBeNull();
  });

  it('ignores irrelevant content without labeled sections', () => {
    const text = 'Sure, let me think about what questions to ask next. What problem are you trying to solve?';
    const fields = extractStructuredFields(text);

    expect(fields.business_value).toBeNull();
    expect(fields.ears_requirements).toBeNull();
    expect(fields.acceptance_criteria).toBeNull();
    expect(fields.constraints).toBeNull();
  });

  it('skips headings with trivial content (length <= 3)', () => {
    const text = [
      '**Business Value**',
      'OK',
      '',
      '**Acceptance Criteria**',
      '.',
    ].join('\n');

    const fields = extractStructuredFields(text);
    // [why] "OK" has only 2 chars, "." has 1 char — both below the 3-char
    // threshold so neither field should be extracted.
    expect(fields.business_value).toBeNull();
    expect(fields.acceptance_criteria).toBeNull();
  });

  it('handles headings without trailing colons', () => {
    const text = [
      '**Business Value**',
      'Cost reduction by automating manual ticket routing.',
      '',
      '**EARS Requirements**',
      'When a ticket is created, the system shall assign it to the correct queue.',
    ].join('\n');

    const fields = extractStructuredFields(text);

    expect(fields.business_value).toContain('Cost reduction');
    expect(fields.ears_requirements).toContain('system shall assign');
  });
});

describe('hasAnyStructuredContent', () => {
  it('returns true when at least one field is present', () => {
    const fields: CardRequirementFields = {
      business_value: 'Some value',
      ears_requirements: null,
      acceptance_criteria: null,
      constraints: null,
    };
    expect(hasAnyStructuredContent(fields)).toBe(true);
  });

  it('returns false when all fields are null', () => {
    const fields: CardRequirementFields = {
      business_value: null,
      ears_requirements: null,
      acceptance_criteria: null,
      constraints: null,
    };
    expect(hasAnyStructuredContent(fields)).toBe(false);
  });
});

describe('formatStructuredBlock', () => {
  it('formats all present fields into a markdown block with score', () => {
    const fields: CardRequirementFields = {
      business_value: 'Improve search performance.',
      ears_requirements: 'The system shall return results in under 200ms.',
      acceptance_criteria: 'Given a query with 10K docs',
      constraints: 'Must not increase memory usage beyond 512MB.',
    };

    const block = formatStructuredBlock(fields, 92);

    expect(block).toContain('## AI-Refined Requirements');
    expect(block).toContain('_Quality score: 92/100');
    expect(block).toContain('### Business Value');
    expect(block).toContain('Improve search performance');
    expect(block).toContain('### EARS Requirements');
    expect(block).toContain('### Acceptance Criteria');
    expect(block).toContain('### Constraints & Non-Goals');
  });

  it('omits sections for null fields', () => {
    const fields: CardRequirementFields = {
      business_value: 'Just this one field.',
      ears_requirements: null,
      acceptance_criteria: null,
      constraints: null,
    };

    const block = formatStructuredBlock(fields, 50);

    expect(block).toContain('### Business Value');
    expect(block).not.toContain('### EARS Requirements');
    expect(block).not.toContain('### Acceptance Criteria');
    expect(block).not.toContain('### Constraints');
  });

  it('returns empty string when all fields are null', () => {
    const fields: CardRequirementFields = {
      business_value: null,
      ears_requirements: null,
      acceptance_criteria: null,
      constraints: null,
    };

    expect(formatStructuredBlock(fields, 0)).toBe('');
  });
});
