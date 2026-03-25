# Sprint 117 — Avatar Proxy Tests

## T11: GET /api/v1/users/me avatar_url contains proxy path, not raw S3 hostname

```
Navigate to http://localhost:3000
Log in as any user who has uploaded an avatar
```

```
Run fetch in browser console:
const res = await fetch('/api/v1/users/me');
const json = await res.json();
console.log(json.data.avatar_url);
```

Expected: `avatar_url` starts with `/api/v1/users/` and ends with `/avatar`; it does NOT contain `s3.amazonaws.com` or `s3.` hostname

---

## T12: GET /api/v1/users/me avatar_url is null when user has no avatar

```
Navigate to http://localhost:3000
Log in as any user who has NOT uploaded an avatar
```

```
Run fetch in browser console:
const res = await fetch('/api/v1/users/me');
const json = await res.json();
console.log(json.data.avatar_url);
```

Expected: `avatar_url` is `null`

---

## T13: GET /api/v1/cards/:id/comments each author avatar_url is a proxy path

```
Navigate to http://localhost:3000
Log in as a board member
Open a card that has at least one comment authored by a user with an avatar
```

```
Run fetch in browser console (replace CARD_ID with a real card id):
const res = await fetch('/api/v1/cards/CARD_ID/comments');
const json = await res.json();
json.data.forEach(c => console.log(c.user_id, c.author_avatar_url));
```

Expected: for each comment where the author has an avatar, `author_avatar_url` starts with `/api/v1/users/` and ends with `/avatar`; it does NOT contain `s3.amazonaws.com`

---

## T14: Unauthenticated GET /api/v1/users/:id/avatar returns 401

```
Navigate to http://localhost:3000
Ensure you are NOT logged in (or open an incognito window)
```

```
Run fetch in browser console (replace USER_ID with any real user id):
const res = await fetch('/api/v1/users/USER_ID/avatar', { redirect: 'manual' });
console.log(res.status);
```

Expected: response status is 401

---

## T15: Authenticated GET /api/v1/users/:id/avatar redirects or returns avatar bytes

```
Navigate to http://localhost:3000
Log in as any user
Find your own user id from GET /api/v1/users/me
```

```
Run fetch in browser console (replace USER_ID with your own user id):
const res = await fetch('/api/v1/users/USER_ID/avatar');
console.log(res.status, res.url);
```

Expected: response status is 200 or the request follows a 302 to an S3 URL; avatar image bytes are returned in the final response

---

## T16: GET /api/v1/users/:id/avatar returns 404 for user with no avatar

```
Navigate to http://localhost:3000
Log in as any user
Find a user id for a user with no avatar (e.g. fresh account)
```

```
Run fetch in browser console (replace NO_AVATAR_USER_ID with the user id):
const res = await fetch('/api/v1/users/NO_AVATAR_USER_ID/avatar', { redirect: 'manual' });
console.log(res.status);
```

Expected: response status is 404

---

## T18: Profile settings avatar img src is a proxy path

```
Navigate to http://localhost:3000
Log in as any user who has uploaded an avatar
Navigate to the profile settings page (e.g. /settings or /profile)
```

Inspect the avatar image element on the profile settings page.

Expected: the `<img>` element inside the avatar uploader section has a `src` attribute that starts with `/api/v1/users/` and ends with `/avatar`; it does NOT contain `s3.amazonaws.com` or any S3 hostname

---

## T19: After uploading an avatar, the displayed avatar uses a proxy path

```
Navigate to http://localhost:3000
Log in as any user
Navigate to profile settings
Upload a new avatar image (JPEG, PNG, or WebP under 5 MB)
```

After the upload completes, inspect the avatar `<img>` element.

Expected: the `src` attribute starts with `/api/v1/users/` and ends with `/avatar`; it does NOT contain `s3.amazonaws.com`

---

## T20: Comment author avatar img src is a proxy path

```
Navigate to http://localhost:3000
Log in as a board member
Open any board, then open a card that has at least one comment from a user with an uploaded avatar
```

Inspect the avatar `<img>` element beside the comment author name in the activity feed.

Expected: the `<img src>` starts with `/api/v1/users/` and ends with `/avatar`; it does NOT contain `s3.amazonaws.com`

---

## T21: Activity event actor avatar img src is a proxy path

```
Navigate to http://localhost:3000
Log in as a board member who has an avatar
Open any board, then open a card that has activity events (e.g. card moved, label added)
```

Inspect the avatar `<img>` element beside an activity event actor in the activity feed.

Expected: the `<img src>` starts with `/api/v1/users/` and ends with `/avatar`; it does NOT contain `s3.amazonaws.com`

