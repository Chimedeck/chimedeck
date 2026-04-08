# 12. Card Attachments

**Prerequisites:** Flow 11 completed. Card detail modal for `Test Card 1` is open.  
**Continues from:** Card detail modal.  
**Ends with:** Card has one file attachment and one link attachment.

---

## Steps

### File Upload

1. Click **Attach file** (or the paperclip icon / **Attachments** section **+** button).
   - **Expected:** A file picker or drag-and-drop overlay appears.

2. Upload a small PNG or text file (< 1 MB).
   - **Expected:** Upload progress indicator appears briefly, then the attachment is listed with its filename in the **Attachments** section.

3. Verify the attachment shows a status badge **Ready** (not Scanning / Rejected).

### Link Attachment

4. Click **Attach a link** (or **Add a URL**) in the Attachments section.
   - **Expected:** A form appears with URL and optional name fields.

5. Enter:
   - **URL:** `https://example.com`
   - **Name:** `Example Link`

6. Click **Attach** (or **Save**).
   - **Expected:** Link attachment `Example Link` appears in the attachments list with the URL below it.

### Verify

7. Confirm the Attachments section now shows 2 items (1 file + 1 link).

---

## Notes

- Leave the modal open for flow **13-card-comments**.
