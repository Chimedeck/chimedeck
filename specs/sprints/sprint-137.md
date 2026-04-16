# Sprint 137 — Card Cover: Aspect Ratio & GIF Support

> **Status:** ⬜ Future
> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)
> **Depends on:** Sprint 90 (card cover DB + API), Sprint 19 (card detail modal)

---

## Goal

Two improvements to card covers:

1. **Adaptive aspect ratio** — instead of a fixed-height strip, the cover area adjusts to either **16:9** or **1:1** based on the image's actual dimensions. The image is always rendered with `object-contain` so nothing is cropped or stretched.
2. **GIF support with looping** — GIFs uploaded as covers bypass thumbnail conversion (WebP strips animation), are served directly via the `/view` endpoint, and play in a continuous loop on the card and in the modal.

---

## Reference Mockup

- **Current:** fixed `h-20` / `h-28` strip, `object-cover` (crops the image)
- **Target:** aspect-ratio container (16:9 wide images, 1:1 square/portrait images), `object-contain`, GIFs animate

---

## Folder / File Changes

```
db/migrations/
  0108_attachment_dimensions.ts       ← new: width + height columns on attachments

server/extensions/attachment/
  workers/thumbnail.ts                ← skip GIF thumbnail; always store width+height

server/common/cards/
  cover.ts                            ← select mime_type+dimensions; derive aspect ratio; GIF → /view URL

src/extensions/Card/components/
  CardItem.tsx                        ← aspect-ratio cover container, object-contain, GIF img tag
  CardModal.tsx                       ← same for modal banner; accept gif in file input
```

---

## Scope

### 1. DB Migration — `0108_attachment_dimensions.ts`

Add `width` and `height` (integer, nullable) to the `attachments` table. Populated by the thumbnail worker for every image (including GIFs). Existing rows default to `NULL`.

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('attachments', (t) => {
    t.integer('width').nullable();
    t.integer('height').nullable();
  });
}
```

---

### 2. Server — `thumbnail.ts` (attachment thumbnail worker)

**Two changes:**

**a. Always populate width + height via Sharp metadata**

After downloading the S3 object, call `sharp(buffer).metadata()` before any resize to get `{ width, height }`. Persist both back to the `attachments` row.

**b. Skip thumbnail generation for GIFs**

GIFs converted to WebP lose animation. When `mimeType === 'image/gif'`, read metadata for dimensions only, persist `width`/`height`, then return — do not write a `thumbnail_key`.

```
if (mimeType === 'image/gif') {
  // store width/height, skip resizing
  await db('attachments').where({ id: attachmentId }).update({ width, height });
  return;
}
// existing resize + thumbnail upload for jpeg/png/webp
```

---

### 3. Server — `cover.ts` (cover resolution)

**Changes to `resolveCoverImageUrls`:**

Add `mime_type`, `width`, `height` to the attachment query. Use them to:

**a. Derive `cover_aspect_ratio`**

```ts
// width / height >= 1.5 → wide image → 16:9
// otherwise → square/portrait → 1:1
const ratio = (width && height && width / height >= 1.5) ? '16:9' : '1:1';
```

**b. GIF → use `/view` URL** (not `/thumbnail`)

When `mime_type === 'image/gif'`, always return the `/view` proxy URL regardless of whether `thumbnail_key` is set — the original GIF must be served to preserve animation.

```ts
const isGif = attachment.mime_type === 'image/gif';
const proxyUrl = (!isGif && attachment.thumbnail_key)
  ? `/api/v1/attachments/${attachment.id}/thumbnail`
  : `/api/v1/attachments/${attachment.id}/view`;
```

**c. Extend `CardWithResolvedCover`**

```ts
export interface CardWithResolvedCover extends CardCoverFields {
  cover_image_url: string | null;
  cover_aspect_ratio: '16:9' | '1:1' | null;  // null when no image cover
  cover_is_gif: boolean;
}
```

---

### 4. Client — `CardItem.tsx`

Replace the fixed-height cover strip with an aspect-ratio container.

**Before:**
```tsx
const coverHeightClass = card.cover_size === 'FULL' ? 'h-28' : 'h-20';
<div className={`w-full ${coverHeightClass}`} ...>
  <img className="h-full w-full object-cover" ... />
</div>
```

**After:**
```tsx
// aspect ratio from resolved cover; color covers keep a fixed strip
const aspectClass = card.cover_image_url
  ? (card.cover_aspect_ratio === '16:9' ? 'aspect-video' : 'aspect-square')
  : (card.cover_size === 'FULL' ? 'h-28' : 'h-20');

<div className={`w-full overflow-hidden ${aspectClass}`} ...>
  <img
    src={card.cover_image_url}
    alt="Card cover"
    className="h-full w-full object-contain"
    loading="lazy"
    // GIFs loop natively in browsers — no extra attribute needed
  />
</div>
```

- Color covers (`cover_color`) keep the fixed `h-20`/`h-28` height — no aspect ratio needed there.
- `object-contain` ensures the image is never cropped or stretched.

---

### 5. Client — `CardModal.tsx`

**a. Cover banner in modal**

Same aspect-ratio logic for the modal's cover banner (`hasCover` section):

```tsx
const bannerAspectClass = card.cover_image_url
  ? (card.cover_aspect_ratio === '16:9' ? 'aspect-video' : 'aspect-square')
  : ((card.cover_size ?? 'SMALL') === 'FULL' ? 'h-44' : 'h-28');

<div className={`w-full overflow-hidden rounded-t-2xl ${bannerAspectClass}`} ...>
  <img
    src={card.cover_image_url}
    className="h-full w-full object-contain bg-slate-900/60"
    loading="eager"
    draggable={false}
  />
</div>
```

**b. File input — accept GIFs explicitly**

```tsx
// change accept to include gif explicitly for clarity (image/* already covers it,
// but being explicit helps browsers show GIFs in the file picker)
<input
  ref={coverInputRef}
  type="file"
  accept="image/jpeg,image/png,image/gif,image/webp"
  className="hidden"
  onChange={handlePickCoverFile}
/>
```

Remove (or update) the `!file.type.startsWith('image/')` guard error message to reflect GIF support:
```tsx
// allow: jpeg, png, gif, webp
const COVER_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
if (!COVER_ALLOWED_TYPES.has(file.type)) {
  setCoverUploadError('Only JPEG, PNG, GIF, and WebP images can be used as a card cover.');
  return;
}
```

---

## Acceptance Criteria

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Upload a wide landscape JPEG (e.g. 1920×1080) as cover | Cover displays at 16:9, image contained, not cropped |
| 2 | Upload a square or portrait image (e.g. 800×800) as cover | Cover displays at 1:1, image contained |
| 3 | Color cover (no image) — compact size | Cover remains `h-20` strip as before |
| 4 | Color cover (no image) — large size | Cover remains `h-28` strip as before |
| 5 | Upload a GIF as cover | GIF displays and loops continuously on card and in modal |
| 6 | Existing JPEG/PNG covers after deploy | `width`/`height` are NULL; client falls back to `1:1` when `cover_aspect_ratio` is null |
| 7 | GIF shows no thumbnail artifact | `/thumbnail` endpoint is never called for GIFs — always uses `/view` |
| 8 | Modal cover banner | Same aspect-ratio logic as board card |

---

## Data Flow Summary

```
Upload GIF
  → requestUploadUrl (mimeType: image/gif allowed ✓)
  → confirmUpload → enqueueScan → generateThumbnail
      → thumbnail.ts detects GIF → reads Sharp metadata → stores width+height → skips resize
  → user sets cover_attachment_id
  → resolveCoverImageUrls
      → reads mime_type=image/gif → proxyUrl = /view (not /thumbnail)
      → cover_aspect_ratio derived from width/height
  → CardItem renders <img src="/view/..."> with aspect-square or aspect-video container
  → GIF plays and loops in browser natively
```

---

## Technical Debt / Notes

- `cover_size` (SMALL/FULL) becomes irrelevant for image covers now that aspect ratio is auto-derived. The SMALL/FULL toggle in the cover menu still applies to color covers. Consider hiding the size toggle when an image cover is active (separate cleanup task).
- Existing cards with image covers will have `cover_aspect_ratio: null` until the thumbnail worker re-processes those attachments. The client should default to `'1:1'` when null — never crash.
- GIF file sizes can be large. Consider adding a separate max-size cap for GIF covers in a future sprint (e.g. 10 MB ceiling).
