# 30. Realtime Updates & Presence

**Prerequisites:** Flow 08 (Add Cards) completed. `Test Board` has cards.  
**Continues from:** Any page. Requires two browser sessions/tabs.  
**Ends with:** Real-time card addition verified across tabs; presence avatars observed.

---

## Steps

### Open Two Tabs

1. Open `Test Board` in **Tab A** (`{TEST_CREDENTIALS.baseUrl}/boards/$boardId`).
   - **Expected:** Board displays lists and cards.

2. Open a new browser tab (**Tab B**) and navigate to the same board URL.
   - **Expected:** Board loads in Tab B. Both tabs are on the same board.

### Verify Presence

3. In **Tab A**, look at the board header for presence avatars (active members list).
   - **Expected:** At least `1` avatar visible (the current user from Tab B joining updates Tab A's presence).

### Real-Time Card Add

4. In **Tab B**, add a new card to the `To Do` list: type `Realtime Card` and confirm.
   - **Expected:** Card `Realtime Card` appears in Tab B immediately.

5. Switch to **Tab A** without refreshing.
   - **Expected:** `Realtime Card` appears in the `To Do` list in **Tab A** automatically (no page reload).

### Real-Time Card Move

6. In **Tab B**, drag `Realtime Card` to `In Progress`.

7. Switch to **Tab A**.
   - **Expected:** `Realtime Card` is in `In Progress` in Tab A (real-time update).

### Reconnect Behaviour

8. In **Tab A**, simulate a temporary disconnect by toggling the browser's network offline (DevTools → Network → Offline) for 3 seconds, then back online.
   - **Expected:** A reconnecting or offline badge briefly appears. Once online, the connection badge returns to **Live** and the board is up-to-date.

---

## Notes

- Clean up: delete `Realtime Card` after the test.
- Continue to flow **31-offline-drafts**.
