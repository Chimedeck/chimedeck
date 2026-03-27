# 31. Offline Draft Recovery

**Prerequisites:** Flow 10 (Edit Card Description). `Test Card 1` has a description.  
**Continues from:** Board view.  
**Ends with:** Offline draft is saved and successfully restored after connection returns.

---

## Steps

### Enter Description Edit Mode

1. Click on `Test Card 1` to open the card detail modal.

2. Click the description area to activate the editor.

3. Select all existing text and replace it with:
   ```
   Draft description written while offline.
   ```
   — do **not** save yet.

### Go Offline

4. Enable browser offline mode: DevTools → Network → check **Offline**.

5. Attempt to save the description (click Save or press the save shortcut).
   - **Expected:** A banner or indicator appears: e.g. `Draft saved` or `You are offline. Changes will sync when you reconnect.`

### Come Back Online

6. Disable offline mode: DevTools → Network → uncheck **Offline**.
   - **Expected:** Connection is restored. A prompt or banner appears offering to **Restore draft** or an automatic sync indicator shows `Syncing…` → `Saved`.

7. If a **Restore draft** button appears, click it.
   - **Expected:** The editor shows `Draft description written while offline.`

8. Save the description.
   - **Expected:** Description is persisted. Reload the card to confirm.

### Discard Draft

9. Open the description editor again, start typing `Discarded text`.

10. Go offline (DevTools).

11. Return online without saving, then click **Discard** (if prompted).
    - **Expected:** Draft is discarded. Editor shows the last saved description.

---

## Notes

- Continue to flow **32-plugins**.
