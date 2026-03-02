# Sprint 21 — Comments, Activity Feed & Attachments UI

> **Sprint plan:** [sprint-plan.md](./sprint-plan.md)  
> **Depends on:** Sprint 19 (Card Detail Modal), Sprints 11–12 (Comments/Attachments API)  
> **References:** [requirements §§5.7, 5.8](../architecture/requirements.md)

---

## Goal

Extend the card detail modal with a threaded comment section, an immutable activity feed, and a file attachment panel (upload, preview, delete). All three surfaces appear as tabs inside the modal's main column.

---

## Scope

### 1. Modal Tab Navigation

Add a tab bar to the `CardModal` main column below the description:

```
[ Description ]  [ Comments (3) ]  [ Activity ]  [ Attachments (2) ]
```

Tab bar styling:
- `flex border-b border-slate-800 mb-4`
- Active tab: `border-b-2 border-indigo-500 text-slate-100`
- Inactive tab: `text-slate-400 hover:text-slate-200 transition-colors`

### 2. Comments Tab

```
src/extensions/Comment/
  components/
    CommentThread.tsx         # scrollable list of CommentItem
    CommentItem.tsx           # avatar + name + timestamp + body + edit/delete actions
    CommentComposer.tsx       # textarea + [Post comment] button
    CommentEditForm.tsx       # inline edit mode for own comments
```

Layout per comment:
```
[Avatar] John Doe  just now                [edit] [delete]  ← own comment only
         Looks good to me! We should also check the mobile layout.
         [Reply]
```

- Composer: `bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-300 placeholder-slate-500 resize-none min-h-[80px] focus:ring-2 focus:ring-indigo-500`
- Timestamps: relative (`2 min ago`, `Yesterday`) using `Intl.RelativeTimeFormat`
- Markdown rendering in comment body (same renderer as Description)
- Edit: replaces body with inline `<textarea>` + [Save] [Cancel]
- Delete: confirmation inline (`text-red-400 text-sm`) — no modal needed

### 3. Activity Tab

```
src/extensions/Activity/
  components/
    ActivityFeed.tsx          # chronological, append-only list
    ActivityItem.tsx          # icon + actor + verb + subject + timestamp
```

Activity item types and icons (lucide-react):

| Type | Icon | Text |
|------|------|------|
| `card_created` | `Plus` | **Ana** created this card |
| `card_moved` | `ArrowRight` | **Ana** moved to **Done** |
| `card_assigned` | `UserPlus` | **Ana** assigned **Ben** |
| `comment_added` | `MessageSquare` | **Ana** commented |
| `due_date_set` | `CalendarClock` | **Ana** set due date to **Mar 15** |
| `attachment_added` | `Paperclip` | **Ana** attached **design.pdf** |
| `checklist_completed` | `CheckSquare` | **Ana** completed **Write tests** |

Activity items use `text-slate-500 text-xs` for timestamp, `text-slate-300 text-sm` for body. No delete/edit (immutable).

### 4. Attachments Tab

```
src/extensions/Attachment/
  components/
    AttachmentList.tsx        # grid of AttachmentCard
    AttachmentCard.tsx        # thumbnail / file icon + name + size + [Download] [Delete]
    AttachmentUploader.tsx    # drag-and-drop zone + file input button
```

Upload zone:
```
┌─────────────────────────────────────────┐
│  📎  Drag files here or click to browse │
│      Max 25 MB · PDF, PNG, JPG, DOCX    │
└─────────────────────────────────────────┘
```
Styling: `border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer transition-colors`

During upload: `<progress>` bar styled with Tailwind (`h-1 bg-indigo-500 rounded-full`).

File type icons: use lucide `FileImage`, `FileText`, `File` based on MIME type.  
Image files: 80×60 px thumbnail via presigned URL.

Upload flow:
1. User drags/selects file → `POST /api/v1/cards/:id/attachments` (multipart)
2. Server returns presigned S3 URL + attachment record
3. `AttachmentCard` renders immediately (optimistic)
4. On error: card removed + error toast

Virus scan state: badge on `AttachmentCard`:
- `SCANNING` → `bg-yellow-500/20 text-yellow-400` spinner
- `READY` → no badge
- `INFECTED` → `bg-red-500/20 text-red-400` "Infected — removed"

### 5. Acceptance Criteria

- [ ] Comments tab shows existing comments and a composer
- [ ] Posting a comment appears immediately and persists after page refresh
- [ ] Editing own comment updates body inline
- [ ] Deleting own comment removes it with an inline confirmation
- [ ] Activity tab shows a chronological, read-only event list
- [ ] Attachments tab shows a drag-and-drop upload zone
- [ ] Uploading a file shows a progress bar and the attachment card on completion
- [ ] Image attachments show a thumbnail
- [ ] Downloading an attachment opens the presigned URL in a new tab
- [ ] Deleting an attachment removes the card with a confirmation prompt

### 6. Tests

```
specs/tests/
  comments.md               # Playwright: post comment, verify it appears, edit it
  activity-feed.md          # Playwright: perform card actions, verify activity log entries
  attachments.md            # Playwright: upload file, verify card appears, download link works
```

---
