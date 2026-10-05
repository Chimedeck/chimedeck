// Tests for secret redactor.
import { describe, it, expect } from 'vitest';
import { redactSecrets } from '../secretRedactor';
import type { ContextChunk } from '../../../types';

describe('redactSecrets', () => {
  const makeChunk = (content: string): ContextChunk => ({
    source: 'code',
    sourcePath: 'test.ts',
    content,
    confidence: 0.9,
  });

  it('passes through non-secret content unchanged', () => {
    const chunks = [makeChunk('This is a normal line of code.\nconst x = 42;')];

    const result = redactSecrets(chunks);

    expect(result[0].content).toBe('This is a normal line of code.\nconst x = 42;');
  });

  it('redacts JWT tokens', () => {
    const chunks = [
      makeChunk(
        'Authorization header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      ),
    ];

    const result = redactSecrets(chunks);

    expect(result[0].content).not.toContain('eyJhbGci');
    expect(result[0].content).toContain('[REDACTED_JWT]');
  });

  it('redacts password assignments', () => {
    const chunks = [
      makeChunk('const config = {\n  password: "supersecret123",\n  api_key: "sk-abc123xyz"\n};'),
    ];

    const result = redactSecrets(chunks);

    expect(result[0].content).toContain('[REDACTED]');
    expect(result[0].content).not.toContain('supersecret123');
  });

  it('redacts connection strings', () => {
    const chunks = [makeChunk('DATABASE_URL=postgres://user:pass@localhost:5432/db')];

    const result = redactSecrets(chunks);

    expect(result[0].content).toContain('[REDACTED_CONNECTION_STRING]');
    expect(result[0].content).not.toContain('postgres://');
  });

  it('does not mutate the original chunk objects', () => {
    const original = makeChunk('password: "secret123"');
    const originalContent = original.content;

    redactSecrets([original]);

    // [why] Original chunk should remain untouched — redaction returns new objects.
    expect(original.content).toBe(originalContent);
  });
});
