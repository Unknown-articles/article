## Turn 1 — Project setup + task model + create tasks

```
Create a React application using modern React (functional components + hooks) with Vite.

Task model — each task must have exactly these fields:
  id:        unique string (e.g. crypto.randomUUID())
  title:     string
  completed: boolean (default false)
  date:      due date string (may be empty)
  createdAt: ISO 8601 string (new Date().toISOString() at creation time)

A task is "late" when: date is non-empty AND the due date has passed AND completed is false.

Implement the task creation form with exactly these data-testid attributes:
  data-testid="task-form"       → the <form> element
  data-testid="task-input"      → the title <input>; must be focused on page load
  data-testid="task-date-input" → the due-date <input>
  data-testid="task-submit"     → the submit button; must have type="submit"

Form behavior:
- Submits on Enter key in the title input and on button click (type="submit" handles both).
- Title must not be empty — do not create a task with a blank title.
- After a successful submission, clear both inputs and keep focus on task-input.

Render the task list below the form with exactly these data-testid attributes:
  data-testid="task-list"   → the list container
  data-testid="task-item"   → each task card; also carries:
                                data-task-id="{id}"
                                data-completed="true|false"
                                data-late="true|false"
  data-testid="task-title"  → the title element inside each card

The UI must be responsive and mobile-friendly.
Deliver the full project structure with all source files.
The app must be fully functional at the end of this step.
Use Git for source control (one commit per feature)
```

---

## Turn 2 — Complete and delete tasks

```
Task creation is working. Now add the ability to complete/uncomplete and delete tasks.

Add these elements to each task card:

  data-testid="task-checkbox"    → the complete/uncomplete toggle
                                   must carry:
                                     aria-checked="true|false"
                                     aria-label="Mark complete" when task is not completed
                                     aria-label="Mark incomplete" when task is completed
                                   aria-label must update whenever the completed state changes

  data-testid="task-delete-btn"  → the delete button

Behavior:
- Clicking task-checkbox toggles the task's completed field between true and false.
- Clicking task-delete-btn removes the task from state permanently.
- After toggling, data-completed and aria-checked on task-item must reflect the new state.
- After toggling, data-late must also be recomputed correctly
  (a completed task is never late even if its due date has passed).

Persistence:
- Save the tasks array to localStorage under the key "tasks" on every state change.
- The stored value must be a JSON array of task objects.
- On page load, restore the tasks array from localStorage.
- If the key does not exist or the value is invalid JSON, start with an empty array.

```

---

## Turn 3 — Inline edit

```
Completion and deletion are working. Now add inline editing of task titles.

Add an edit button to each task card:
  data-testid="task-edit-btn"  → the edit button (visible when the task is not being edited)

When the user clicks task-edit-btn, replace the task-title element with an inline edit
form inside the same task card DOM node. The rest of the card must remain visible and in place.

Inline edit elements (rendered inside the card, replacing task-title):
  data-testid="inline-edit-input"   → the title input; pre-filled with the current title
  data-testid="inline-edit-save"    → the Save button
  data-testid="inline-edit-cancel"  → the Cancel button

Inline edit behavior:
- Pressing Enter saves the edit.
- Pressing Escape cancels without saving.
- Clicking inline-edit-save saves the new title.
- Clicking inline-edit-cancel cancels without saving.
- Saving with an empty or whitespace-only title must be prevented — do not save.
- After saving or cancelling, the card returns to its normal display
  (task-title reappears, inline form is removed).
- Only one task may be in edit mode at a time.
  Opening edit on one card must close any other open inline editor without saving.

```

---

## Turn 4 — Filters

```
Inline editing is working. Now add task filters.

Implement four filter buttons with exactly these data-testid attributes:
  data-testid="filter-all"       → shows all tasks (default active filter)
  data-testid="filter-pending"   → shows tasks where completed is false AND not late
  data-testid="filter-completed" → shows tasks where completed is true
  data-testid="filter-late"      → shows tasks where date has passed AND completed is false

Each filter button must:
  - Carry aria-pressed="true" when it is the active filter, "false" otherwise.
  - Display a count badge of matching tasks:
      data-testid="filter-count-all"        → total number of tasks
      data-testid="filter-count-pending"    → number of pending tasks
      data-testid="filter-count-completed"  → number of completed tasks
      data-testid="filter-count-late"       → number of late tasks

Filtering behavior:
- Only tasks matching the active filter are shown in task-list.
- Counts always reflect the full task array — not just the visible subset.
- The "late" classification must be recomputed dynamically
  (a task with a past due date that gets completed must immediately leave the late count).
- Filter selection is NOT persisted to localStorage.
- Default active filter on page load is "all".

```

---

## Turn 5 — Action log

```
Filters are working. Now add a visible action log that records every user action.

Action log container:
  data-testid="action-log"   → the log container (always visible)

Each log row:
  data-testid="log-entry"      → the row wrapper
  data-testid="log-type"       → the action type label
  data-testid="log-timestamp"  → the timestamp element

Each log entry must be an object with exactly these fields:
  type:        string  — one of the exact strings listed below
  description: string  — human-readable (e.g. "Added task: Buy groceries")
  timestamp:   string  — ISO 8601 (new Date().toISOString())
  payload:     object | null

Valid type strings (use these exact values — no variations):
  ADD_TASK | EDIT_TASK | DELETE_TASK | TOGGLE_TASK | SET_FILTER

Log every user action:
  - Creating a task    → ADD_TASK,    payload: the new task object
  - Editing a task     → EDIT_TASK,   payload: { id, oldTitle, newTitle }
  - Deleting a task    → DELETE_TASK, payload: { id, title }
  - Toggling a task    → TOGGLE_TASK, payload: { id, completed: <new value> }
  - Changing a filter  → SET_FILTER,  payload: { filter: <new filter name> }

Display rules:
- Show the most recent entries at the top of the log.
- The action log is NOT persisted to localStorage.
- The log must not be cleared when the page is refreshed (it resets naturally since it is not persisted).

```

---

## Turn 6 — Undo / redo system

```
The action log is working. Now add undo and redo for task state changes.

Undo/redo requirements:
- Maintain a history stack of tasks array snapshots.
- Ctrl+Z        → undo: restore the previous snapshot.
- Ctrl+Shift+Z  → redo: restore the next snapshot after an undo.

Operations that must be undoable and redoable:
  ADD_TASK, EDIT_TASK, DELETE_TASK, TOGGLE_TASK

Operations that must NOT affect the history stack:
  SET_FILTER (filter changes are not undoable)

History behavior:
- Every undoable action pushes the current tasks array onto the undo stack before applying the change.
- After an undo, the redo stack holds the state that was undone.
- Performing any new undoable action after an undo must clear the redo stack entirely.
- Undo and redo must not fire when the respective stack is empty.

Log undo and redo actions using these exact type strings:
  UNDO  → description: "Undo: <description of the action that was undone>"
           payload: null
  REDO  → description: "Redo: <description of the action that was redone>"
           payload: null

After an undo or redo:
- The tasks array in state must reflect the restored snapshot.
- localStorage must be updated to match the restored snapshot.
- The action log must append the UNDO or REDO entry (the log itself is not rolled back).

The history stack is NOT persisted to localStorage.

```

---

## Turn 7 — Drag-and-drop reordering (desktop)

```
Undo/redo is working. Now add drag-and-drop reordering for desktop users.

Add a drag handle to each task card:
  data-testid="task-drag-handle"  → the drag handle element

Drag-and-drop behavior:
- Users initiate a drag by holding the drag handle (task-drag-handle).
- Dragging a card to a new position reorders the tasks array in state.
- The new order must be reflected immediately in the task-list.
- The reordered tasks array must be saved to localStorage under "tasks".
- Reordering must log a REORDER action in the action log:
    type:        "REORDER"
    description: "Reordered tasks"
    payload:     { fromIndex: number, toIndex: number }
- Reordering must be undoable via Ctrl+Z.

Implementation note:
- You may use the native HTML5 Drag and Drop API (draggable attribute +
  dragstart / dragover / drop events) or a lightweight library — your choice.
- The drag handle must be the drag initiation point; dragging from the card body
  (outside the handle) must not start a drag.
- Drag-and-drop must work correctly when a filter is active
  (only reorder within the visible filtered subset; do not affect hidden tasks).

```

---

## Turn 8 — Mobile gestures (swipe to delete + tap to complete)

```
Drag-and-drop is working. Now add touch gesture support for mobile users.

Implement both gestures using native TouchEvents
(touchstart, touchmove, touchend) — do not use a gesture library.

Swipe to delete:
- Track horizontal finger displacement from touchstart to touchend.
- When the displacement exceeds 100px in either direction:
    - Remove the task from state within 300ms after the threshold is crossed.
    - Log a DELETE_TASK action.
    - The deletion must be undoable via Ctrl+Z.
- Do not trigger swipe-to-delete during a vertical scroll (if the vertical
  displacement exceeds the horizontal, treat it as a scroll, not a swipe).

Tap to complete:
- A short tap on the task card body (not on the checkbox, edit button, delete button,
  or drag handle) must toggle the task's completed state.
- "Short tap" means touchstart and touchend occur at nearly the same position
  (displacement < 10px) and within a short time window (< 200ms).
- Log a TOGGLE_TASK action.
- The toggle must be undoable.

Coexistence rules:
- Swipe-to-delete and tap-to-complete must not conflict with each other.
- Touch events on interactive elements (checkbox, edit button, delete button,
  drag handle) must not trigger swipe or tap gestures.
- The swipe gesture must not interfere with normal vertical page scrolling.

```

---

## Turn 9 — State attributes + accessibility audit

```
All interactive features are working. Now do a full state attribute
and accessibility audit and fix any gaps.

data attributes on task-item — confirm and fix:
- data-task-id="{id}"            present on every task card
- data-completed="true|false"    updates immediately on every toggle
- data-late="true|false"         recomputed correctly:
                                   true  → date is non-empty, due date has passed, completed is false
                                   false → any other condition (including completed=true)

aria attributes on task-checkbox — confirm and fix:
- aria-checked="true"  when completed is true
- aria-checked="false" when completed is false
- aria-label="Mark complete"   when completed is false
- aria-label="Mark incomplete" when completed is true
- Both attributes must update immediately on every toggle.

aria attributes on filter buttons — confirm and fix:
- aria-pressed="true"  on the currently active filter button
- aria-pressed="false" on all other filter buttons
- Must update immediately when the active filter changes.

data-testid completeness check — confirm every element is present:
  task-form, task-input, task-date-input, task-submit
  task-list, task-item, task-title, task-checkbox, task-edit-btn,
  task-delete-btn, task-drag-handle
  inline-edit-input, inline-edit-save, inline-edit-cancel
  filter-all, filter-pending, filter-completed, filter-late
  filter-count-all, filter-count-pending, filter-count-completed, filter-count-late
  action-log, log-entry, log-type, log-timestamp

Responsive and mobile audit:
- Confirm the layout renders correctly on a 375px wide viewport.
- Confirm task-input is focused on page load.
- Confirm btn-submit has type="submit".
- Confirm filter counts always reflect the full task array, not just the visible subset.

Deliver all updated source files.
```

---

## Turn 10 — Final review + persistence audit + deliver

```
All features are implemented. Do a final correctness audit and deliver the project.

Task model audit:
1. Confirm every created task has: id, title, completed, date, createdAt.
2. Confirm id is unique across all tasks (use crypto.randomUUID() or equivalent).
3. Confirm createdAt is an ISO 8601 string set at creation time and never modified.
4. Confirm "late" is computed as: date non-empty AND due date < now AND completed is false.
5. Confirm a completed task is never considered late, even if its due date has passed.

Persistence audit:
6. Confirm tasks are saved to localStorage under the key "tasks" on every state change
   (add, edit, delete, toggle, reorder, undo, redo).
7. Confirm the stored value is a valid JSON array of task objects.
8. Confirm the app restores tasks from localStorage on page load.
9. Confirm filter selection is NOT persisted.
10. Confirm the action log is NOT persisted.
11. Confirm the undo/redo history is NOT persisted.

Action log audit:
12. Confirm every user action logs an entry with: type, description, timestamp, payload.
13. Confirm only these exact type strings appear:
    ADD_TASK, EDIT_TASK, DELETE_TASK, TOGGLE_TASK, REORDER, SET_FILTER, UNDO, REDO.
14. Confirm the most recent entry appears at the top of the log.

Undo/redo audit:
15. Confirm Ctrl+Z undoes the last undoable action and updates localStorage.
16. Confirm Ctrl+Shift+Z redoes after an undo and updates localStorage.
17. Confirm a new undoable action after an undo clears the redo stack.
18. Confirm SET_FILTER does not push to the history stack.

Gesture and interaction audit:
19. Confirm swipe-to-delete removes the task within 300ms after the 100px threshold.
20. Confirm swipe-to-delete does not trigger during vertical scrolling.
21. Confirm tap-to-complete does not conflict with swipe-to-delete.
22. Confirm drag-and-drop reordering works correctly when a filter is active.
23. Confirm task-input is focused on page load.
24. Confirm the inline editor closes without saving on Escape.
25. Confirm only one task is in edit mode at a time.

Deliver the complete final project structure with all React components and source files.
```