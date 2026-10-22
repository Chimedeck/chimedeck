// Endpoint contract test — attachment reorder authorization parity.
// [why] The reorder handler shipped with requireRole(req,'MEMBER') while every
// sibling attachment mutation (requestUploadUrl/confirmUpload/addUrl) uses the
// shared requireMemberOrBoardGuestMember helper. A board guest invited with the
// MEMBER sub-type could upload/add attachments but got 403 reordering them.
// [why subprocess fixture] The assertions run in ./fixtures/reorderRoleContract.ts
// (spawned process) — they need process-global mock.module on shared db/auth/
// permissionManager modules, which would otherwise leak into (or be overwritten
// by) adjacent suites that mock the same modules differently.
import { describe, expect, test } from 'bun:test';

describe('attachment reorder — shared attachment authorization contract (subprocess fixture)', () => {
  test('guest-MEMBER passes the shared attachment policy; plain guest 403 insufficient-role', async () => {
    const child = Bun.spawn(
      [process.execPath, new URL('./fixtures/reorderRoleContract.ts', import.meta.url).pathname],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(stderr).toBe('');
    expect(exitCode).toBe(0);
    expect(stdout).toContain(
      'reorder authorization verified: guest-MEMBER passes the shared attachment policy, plain guest 403 insufficient-role'
    );
  });
});
