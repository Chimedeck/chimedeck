# Sprint 117 — Secure Attachment Proxy Tests

## T1: Unauthenticated GET /attachments/:id/view returns 401

```
Navigate to http://localhost:3000
```

```
Run fetch in browser console:
const res = await fetch('/api/v1/attachments/nonexistent-id/view', { redirect: 'manual' });
console.log(res.status);
```

Expected: response status is 401

---

## T2: Authenticated non-member GET /attachments/:id/view returns 403

```
Navigate to http://localhost:3000
Log in as a user who is NOT a member of the board owning the attachment
```

```
Run fetch in browser console (replace ATTACHMENT_ID with a real id from another board):
const res = await fetch('/api/v1/attachments/ATTACHMENT_ID/view', { redirect: 'manual' });
console.log(res.status);
```

Expected: response status is 403

---

## T3: Authenticated board member GET /attachments/:id/view returns 200 or 302

```
Navigate to http://localhost:3000
Log in as a board member
Open a card that has a FILE attachment in READY status
Open the browser console
```

```
First get the attachment id from the list endpoint:
const list = await fetch('/api/v1/cards/CARD_ID/attachments').then(r => r.json());
const id = list.data[0].id;
console.log('attachment id:', id);
```

```
Now test the view proxy:
const res = await fetch('/api/v1/attachments/' + id + '/view', { redirect: 'manual' });
console.log('status:', res.status);
```

Expected: response status is 200 or 302 (redirect to presigned S3 URL)

---

## T4: List attachments response contains view_url proxy path (not raw S3)

```
Navigate to http://localhost:3000
Log in as a board member
Open a card that has attachments
Open the browser console
```

```
const res = await fetch('/api/v1/cards/CARD_ID/attachments').then(r => r.json());
const attachment = res.data[0];
console.log('view_url:', attachment.view_url);
console.log('has s3 hostname:', attachment.view_url?.includes('s3.amazonaws.com') || attachment.view_url?.includes('s3.') );
console.log('is proxy path:', attachment.view_url?.startsWith('/api/v1/attachments/'));
```

Expected:
- `view_url` starts with `/api/v1/attachments/` and ends with `/view`
- `view_url` does NOT contain `s3.amazonaws.com` or any S3 hostname
- No `url` field with a raw presigned URL is present (or it is null)

---

## T5: List attachments response includes alias field

```
Navigate to http://localhost:3000
Log in as a board member
Open a card with attachments
Open the browser console
```

```
const res = await fetch('/api/v1/cards/CARD_ID/attachments').then(r => r.json());
const attachment = res.data[0];
console.log('alias field present:', 'alias' in attachment);
console.log('alias value:', attachment.alias);
```

Expected:
- `alias` key is present on each attachment object
- `alias` is `null` for attachments that have not been renamed

---

## T6: Thumbnail proxy returns 404 when no thumbnail exists

```
Navigate to http://localhost:3000
Log in as a board member
Open the browser console
```

```
const list = await fetch('/api/v1/cards/CARD_ID/attachments').then(r => r.json());
const noThumb = list.data.find(a => a.thumbnail_url === null);
if (noThumb) {
  const res = await fetch('/api/v1/attachments/' + noThumb.id + '/thumbnail', { redirect: 'manual' });
  console.log('status for missing thumbnail:', res.status);
}
```

Expected: response status is 404

---

## T7: Thumbnail proxy redirects for attachment with thumbnail

```
Navigate to http://localhost:3000
Log in as a board member
Open the browser console
```

```
const list = await fetch('/api/v1/cards/CARD_ID/attachments').then(r => r.json());
const withThumb = list.data.find(a => a.thumbnail_url !== null);
if (withThumb) {
  const res = await fetch('/api/v1/attachments/' + withThumb.id + '/thumbnail', { redirect: 'manual' });
  console.log('status for thumbnail with key:', res.status);
}
```

Expected: response status is 200 or 302
