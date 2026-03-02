import { describe, expect, test } from 'bun:test';
import { issueAccessToken } from './issue';
import { verifyAccessToken } from './verify';

// Test RS256 key pair — for unit tests only, never use in production.
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC2NOT8Xg5DzArt
D1NfpXntAtgTXXSDz9JJ++0yVvw0wRdGJSPEeYgGyY+K+M6+ujExOyWuFos4gD2F
Md3VVwZXFYQMPXrOVDSBOKHbB9XIfx16mT55PCMaAcspYnxRO+m97HkrzwfxTOd7
M+CjYawq2WNVN8zTfeOb5HmTbRGu7YV/JazD/2O94IP3IWxNsI8lP0zXdXOaNSaQ
QNA5hW3ypFDlZz1fIRvdR5pW8VA4XkuFuEQlKO/U/Fhm7eNRxFOylREcv2xeYqF6
S67Z7wbptuV9U6qqIyNBZ9Ro60TeFgwmEwORy0fL/Re5x1Sn2sRomVN4gPUstzh1
1ZX5ue2RAgMBAAECggEAGZxQNl/TEfj/bShLEAXeoC+W5wvrCW7/8CnCwqFi5Fhi
uNeWEjMB6XBR5pcH2lup9/FIH9Ln4Tp3Sz5B38+SYtGxpJXMqe1AjwxChdqxVDP3
1QhutVQ8W9a2M3w2HKX2+hzfwEZip6pnXBQj5lsfe8tgELWd6vlGMZ6Y7x20z1kz
PWqDPQC9rUtQS0Vq9HwhVpzlNMqHUPLVt7GIlmMxZdTZXcaBu2k3uGVaFfh00AHB
6IlNUfq8DympMTEP9oW87ApSj5awMaFBtlXwbZTubICZamQtb8kWhZqPcG+BAsqn
LaHodRhnmsnUV7Uo7X1YBlOryqcStzWv5NsnICZ2pQKBgQDed7Hid0ieHnmJbNWj
6LeMdn+sELgi17YL3MCuYqAPP3CjTzj2hD9eCdf899D3EKqO+iFRiP4UlLy5G/C+
JWEL+TMQ5CsQ3qZ0vnehxMg8O0Jvjc6pySvtcjqVlDyPfqdSYWCoKLMO8oD8+cwx
+WZNY/UgT+2ZO6LQFyBn+TMoxQKBgQDRq6jveeGV17vrDTKee2IpPgQ2mqg4LDNl
6mabDODcI51qcOyPCxmRtIfls5g+L3JgGUDXr+BZSoZhkTHYhINdr1RokDJDPioe
ZCURN0S1SNhM+PkDWmjtfio1RyO8dUc//S2+q+ZsNxCCcxIJwY90xPCe5MU0imrB
06DfSmmGXQKBgBbPry3JjWipN00gG8fy1N9SR0UdccQg2kndGOTIuCDYIHSeavjc
FqNN3xfRUVwEGXkPrNrvcR4rIi7Y7paQvqK7qsDQpJnWOrs9zIaJ5v5GFUnbAJXo
StjOHbO4v3z3P7DyyzZy9elSdGd8NbPqHtNQrJHjoDlWJBuyQ2Bl7RkBAoGBAJGi
S1Azd0ZON7+3Rg6govkEk4ad+/Qwd2711lkiI9mkf0WctCNTUWpMXAxnp3qiGC65
u7lU917uDdMdN+Mtf9WF3/pVFiRwvG6pnrmLixTkSSGF2ejDVpiHhqfFBwRy7Y97
utdyrTVDNht18/SE1rEDziJ/wp6Q+kAxT89o700dAoGAMYJk4lP1RNLQOI4C9gR7
D6qFShCER6GC3R6B5uVwHJJIV+LAqyVmO6Z91tio7KyC8JfHRmoTpEfwHvvydiRl
M0VGeVBgMIBqSiYkJh4WJ2/JEHhxJ3MsYeICHnaJC/xtKYsBrAA1XlAnlHC3oslQ
ILGSHKmmvSwNhBR0l5c6Mgw=
-----END PRIVATE KEY-----`;

const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtjTk/F4OQ8wK7Q9TX6V5
7QLYE110g8/SSfvtMlb8NMEXRiUjxHmIBsmPivjOvroxMTslrhaLOIA9hTHd1VcG
VxWEDD16zlQ0gTih2wfVyH8depk+eTwjGgHLKWJ8UTvpvex5K88H8UznezPgo2Gs
KtljVTfM033jm+R5k20Rru2FfyWsw/9jveCD9yFsTbCPJT9M13VzmjUmkEDQOYVt
8qRQ5Wc9XyEb3UeaVvFQOF5LhbhEJSjv1PxYZu3jUcRTspURHL9sXmKhekuu2e8G
6bblfVOqqiMjQWfUaOtE3hYMJhMDkctHy/0XucdUp9rEaJlTeID1LLc4ddWV+bnt
kQIDAQAB
-----END PUBLIC KEY-----`;

// Temporarily override jwtConfig keys for tests.
// We mock by patching the module-level config object.
import { jwtConfig } from '../../common/config/jwt';

describe('token issue and verify', () => {
  test('issues a JWT and verifies it successfully', async () => {
    // Patch keys for this test run (env vars may not be set in CI).
    (jwtConfig as { privateKey: string; publicKey: string }).privateKey = TEST_PRIVATE_KEY;
    (jwtConfig as { privateKey: string; publicKey: string }).publicKey = TEST_PUBLIC_KEY;

    const token = await issueAccessToken({ sub: 'user-123', email: 'test@example.com' });
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // JWT has 3 parts

    const decoded = await verifyAccessToken({ token });
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe('user-123');
    expect(decoded!.email).toBe('test@example.com');
  });

  test('returns null for an invalid token', async () => {
    const result = await verifyAccessToken({ token: 'not.a.valid.jwt' });
    expect(result).toBeNull();
  });

  test('returns null for a tampered token', async () => {
    (jwtConfig as { privateKey: string; publicKey: string }).privateKey = TEST_PRIVATE_KEY;
    (jwtConfig as { privateKey: string; publicKey: string }).publicKey = TEST_PUBLIC_KEY;

    const token = await issueAccessToken({ sub: 'user-123', email: 'test@example.com' });
    const [header, payload] = token.split('.');
    const tampered = `${header}.${payload}.invalidsignature`;

    const result = await verifyAccessToken({ token: tampered });
    expect(result).toBeNull();
  });
});
