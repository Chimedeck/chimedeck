# Sprint 117 — Attachment Edit (Inline Rename) Tests

## Setup

```
Navigate to http://localhost:5173
```

```
Click "Sign in"
Fill in email: "test@example.com"
Fill in password: "password"
Click "Sign in" button
```

```
Click on a board
Click on a card that has at least one READY file attachment
```

---

## T7a — Edit button appears on attachment row

```
Locate the attachment list inside the card modal
Assert that the element with data-testid "attachment-list" is visible
Assert that the element with data-testid "attachment-edit-button" is visible within the attachment list
```

---

## T7b — Clicking Edit shows input pre-filled with current display name

```
Note the text content of the first attachment name span within data-testid "attachment-list"
Click the element with data-testid "attachment-edit-button" on the first attachment row
Assert that the element with data-testid "attachment-rename-input" is visible
Assert that the value of data-testid "attachment-rename-input" equals the attachment name noted above
```

---

## T7c — Pressing Escape reverts to original name (alias unchanged)

```
Click the element with data-testid "attachment-edit-button" on the first attachment row
Assert that data-testid "attachment-rename-input" is visible
Clear the input and type "Temporary name that should not save"
Press "Escape" key on data-testid "attachment-rename-input"
Assert that data-testid "attachment-rename-input" is not visible
Assert that the attachment row still shows the original name (not "Temporary name that should not save")
```

---

## T7d — Pressing Enter with a valid name saves the new alias

```
Click the element with data-testid "attachment-edit-button" on the first attachment row
Assert that data-testid "attachment-rename-input" is visible
Clear the input field data-testid "attachment-rename-input"
Type "My Renamed File" into data-testid "attachment-rename-input"
Press "Enter" on data-testid "attachment-rename-input"
Assert that data-testid "attachment-rename-input" is not visible
Assert that the first attachment row in data-testid "attachment-list" shows the text "My Renamed File"
```

---

## T7e — Blur (click away) with a valid name saves the new alias

```
Click the element with data-testid "attachment-edit-button" on the first attachment row
Assert that data-testid "attachment-rename-input" is visible
Clear the input field data-testid "attachment-rename-input"
Type "Blurred Rename" into data-testid "attachment-rename-input"
Click somewhere outside the input (e.g. the panel title)
Assert that data-testid "attachment-rename-input" is not visible
Assert that the first attachment row in data-testid "attachment-list" shows the text "Blurred Rename"
```

---

## T7f — Empty input does not submit (rename is rejected)

```
Click the element with data-testid "attachment-edit-button" on the first attachment row
Assert that data-testid "attachment-rename-input" is visible
Clear the input field data-testid "attachment-rename-input" completely (leave it empty)
Press "Enter" on data-testid "attachment-rename-input"
Assert that data-testid "attachment-rename-input" is still visible (edit mode not exited)
Assert that the input has a red border or error styling (border-red-500 class)
```

---

## T7g — Cancel button while editing closes without saving

```
Click the element with data-testid "attachment-edit-button" on the first attachment row
Assert that data-testid "attachment-rename-input" is visible
Assert that data-testid "attachment-rename-cancel" is visible
Clear the input and type "Should not be saved via cancel"
Click data-testid "attachment-rename-cancel"
Assert that data-testid "attachment-rename-input" is not visible
Assert that the attachment row does not show "Should not be saved via cancel"
```

---

## T10 — Attachment with no alias shows original name

```
Locate an attachment in data-testid "attachment-list" that has no alias set (newly uploaded)
Assert that the attachment name span shows the original filename (e.g. "document.pdf")
Click data-testid "attachment-edit-button" for that attachment
Assert that the value of data-testid "attachment-rename-input" equals the original filename
Press "Escape" to cancel
```
