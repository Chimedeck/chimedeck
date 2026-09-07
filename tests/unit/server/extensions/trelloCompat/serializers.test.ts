import { describe, expect, it } from 'bun:test';
import { serializeMember } from '../../../../../server/extensions/trelloCompat/serializers/member';
import { rankToPos } from '../../../../../server/extensions/trelloCompat/serializers/position';

describe('trelloCompat serializers', () => {
  it('serializeMember derives initials and username', () => {
    const result = serializeMember({
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com',
    });

    expect(result.fullName).toBe('John Doe');
    expect(result.initials).toBe('JD');
    expect(result.username).toBe('john');
  });

  it('serializeMember supports single-word names', () => {
    const result = serializeMember({
      id: 'user-2',
      name: 'Alice',
      email: 'alice@example.com',
    });

    expect(result.initials).toBe('A');
  });

  it('rankToPos converts rank to trello pos', () => {
    expect(rankToPos(0)).toBe(65535);
    expect(rankToPos(2)).toBe(196605);
  });
});
