# Admin Auto-Verify Email — API Tests

## Test: POST /api/v1/admin/users with autoVerifyEmail=true sets email_verified_at

```playwright
// Scenario: Admin creates user with autoVerifyEmail=true
// Expected: response data.email_verified_at is a non-null ISO timestamp

const response = await request.post('/api/v1/admin/users', {
  headers: { Authorization: `Bearer ${adminToken}` },
  data: {
    email: 'newuser@example.com',
    displayName: 'New User',
    autoVerifyEmail: true,
  },
});

expect(response.status()).toBe(201);
const body = await response.json();
expect(body.data.email_verified_at).not.toBeNull();
expect(typeof body.data.email_verified_at).toBe('string');
// Verify it is a valid ISO date string
expect(new Date(body.data.email_verified_at).getTime()).not.toBeNaN();
```

## Test: POST /api/v1/admin/users with autoVerifyEmail=false returns null email_verified_at

```playwright
// Scenario: Admin creates user with autoVerifyEmail=false
// Expected: response data.email_verified_at is null

const response = await request.post('/api/v1/admin/users', {
  headers: { Authorization: `Bearer ${adminToken}` },
  data: {
    email: 'anotheruser@example.com',
    displayName: 'Another User',
    autoVerifyEmail: false,
  },
});

expect(response.status()).toBe(201);
const body = await response.json();
expect(body.data.email_verified_at).toBeNull();
```

## Test: POST /api/v1/admin/users without autoVerifyEmail returns null email_verified_at

```playwright
// Scenario: Admin creates user without providing autoVerifyEmail (default behaviour)
// Expected: response data.email_verified_at is null (backward-compatible)

const response = await request.post('/api/v1/admin/users', {
  headers: { Authorization: `Bearer ${adminToken}` },
  data: {
    email: 'legacyuser@example.com',
    displayName: 'Legacy User',
  },
});

expect(response.status()).toBe(201);
const body = await response.json();
expect(body.data.email_verified_at).toBeNull();
```

## Test: autoVerifyEmail=true can be combined with sendEmail=true

```playwright
// Scenario: Admin auto-verifies and sends invite email in the same request
// Expected: email_verified_at is set and emailSent reflects actual SES state

const response = await request.post('/api/v1/admin/users', {
  headers: { Authorization: `Bearer ${adminToken}` },
  data: {
    email: 'inviteduser@example.com',
    displayName: 'Invited User',
    autoVerifyEmail: true,
    sendEmail: true,
  },
});

expect(response.status()).toBe(201);
const body = await response.json();
expect(body.data.email_verified_at).not.toBeNull();
// emailSent depends on SES_ENABLED flag — just verify field is present
expect(typeof body.emailSent).toBe('boolean');
```
