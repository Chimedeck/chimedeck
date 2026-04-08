# 27. Custom Fields

**Prerequisites:** Flow 06 (Create Board) completed. On `Test Board` in Kanban view.  
**Continues from:** Board view.  
**Ends with:** Three custom fields created (Text, Number, Checkbox). Values set on `Test Card 1`.

---

## Steps

### Create Fields

1. Open the **Custom Fields** panel (board sidebar or **⋮** → **Custom Fields**).
   - **Expected:** Panel opens with the heading `Custom Fields` and an empty state `No custom fields yet`.

2. Click **+ Add custom field**.
   - **Expected:** A form appears prompting field type and name.

3. Select type **Text** and name it `Notes`, then save.
   - **Expected:** `Notes` text field appears in the list.

4. Click **+ Add custom field** again. Select type **Number**, name it `Story Points`, save.
   - **Expected:** `Story Points` field appears in the list.

5. Click **+ Add custom field** again. Select type **Checkbox**, name it `Blocked?`, save.
   - **Expected:** `Blocked?` field appears in the list.

### Set Values on a Card

6. Click on `Test Card 1` to open its detail modal.
   - **Expected:** Custom Fields section is visible in the modal with all three fields.

7. Click the `Notes` field. Enter `This card needs review.` and save.
   - **Expected:** Text appears under the `Notes` field.

8. Click the `Story Points` field. Enter `5` and save.
   - **Expected:** Number `5` appears under `Story Points`.

9. Toggle the `Blocked?` checkbox to checked.
   - **Expected:** Checkbox shows a checked state.

### Verify in Table View

10. Close the modal. Switch to **Table** view.
    - **Expected:** Custom field columns (`Notes`, `Story Points`, `Blocked?`) appear. `Test Card 1` row shows the values entered.

11. Switch back to **Kanban** view.

---

## Notes

- Continue to flow **28-notifications**.
