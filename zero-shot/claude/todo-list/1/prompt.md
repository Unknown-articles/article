Create a To-Do List application using React with the following requirements:

GENERAL

- Use modern React.
- The UI must be responsive and mobile-friendly.

FEATURES

Task Model

- Each task must include:
    - id (unique)
    - title
    - completed (boolean)
    - date (due date)
    - createdAt
- A task can be in a "late" state if the due date has passed and it is not completed.

Task Management

- Create, edit, delete tasks
- Mark tasks as completed/uncompleted

Task Form

- The form must submit when the user presses Enter in the title input.
- The submit button must have type="submit".
- The title input must be focused on page load.

Inline Edit

- When editing is active, the task title element is replaced by an inline form inside the same task card DOM node.
- Pressing Escape must cancel without saving.
- Pressing Enter must save.
- Clicking a Cancel button must cancel without saving.

Drag-and-Drop

- Allow reordering tasks via drag-and-drop
- Persist the new order in state

Mobile-Friendly Gestures

- Support touch interactions:
    - Swipe to delete: triggered when horizontal displacement exceeds 100px (responding to native TouchEvents: touchstart, touchmove, touchend); the task must be removed from state within 300ms after threshold
    - Tap to complete
- Ensure usability on mobile devices

Filters

- Implement filters:
    - All
    - Completed
    - Pending
    - Late
- Filtering should be dynamic and efficient
- Each filter button must display the count of matching tasks

Undo/Redo System

- Implement undo/redo functionality
- Maintain a history of state changes
- Support:
    - Ctrl+Z → undo
    - Ctrl+Shift+Z → redo

Action Log

- Maintain a visible log of user actions (similar to Redux DevTools)
- Each action must include:
    - type: one of the following exact strings:
        ADD_TASK | EDIT_TASK | DELETE_TASK | TOGGLE_TASK | REORDER | SET_FILTER | UNDO | REDO
    - description: human-readable string
    - timestamp: ISO 8601 string (e.g. new Date().toISOString())
    - payload: object or null

Persistence

- Save the tasks array to localStorage using the key: "tasks"
- The stored value must be a JSON array of task objects
- On load, read this key to restore state
- Filter selection and action log are NOT persisted

TESTABILITY

Apply the following data-testid attributes to every interactive and observable element:

Task Form
- data-testid="task-form"           → the <form> element
- data-testid="task-input"          → the title <input>
- data-testid="task-date-input"     → the due-date <input>
- data-testid="task-submit"         → the submit button

Task List
- data-testid="task-list"           → the list container
- data-testid="task-item"           → each task card (also add data-task-id="{id}")
- data-testid="task-title"          → the title element inside each card
- data-testid="task-checkbox"       → the complete/uncomplete toggle
- data-testid="task-edit-btn"       → the edit button
- data-testid="task-delete-btn"     → the delete button
- data-testid="task-drag-handle"    → the drag handle

Inline Edit Form
- data-testid="inline-edit-input"   → the title input
- data-testid="inline-edit-save"    → the Save button
- data-testid="inline-edit-cancel"  → the Cancel button

Filters
- data-testid="filter-all"          → the All filter button
- data-testid="filter-pending"      → the Pending filter button
- data-testid="filter-completed"    → the Completed filter button
- data-testid="filter-late"         → the Late filter button
- data-testid="filter-count-{id}"   → the count badge inside each filter button (e.g. filter-count-all)

Action Log
- data-testid="action-log"          → the log container
- data-testid="log-entry"           → each log row
- data-testid="log-type"            → the action type label (e.g. ADD_TASK)
- data-testid="log-timestamp"       → the timestamp element

State Attributes

Each task card (data-testid="task-item") must expose its state via data attributes:
- data-completed="true|false"
- data-late="true|false"

The checkbox/toggle must use:
- aria-checked="true|false"
- aria-label="Mark complete" or "Mark incomplete" (must change with state)

Each filter button must use:
- aria-pressed="true|false"

DEVELOPMENT PROCESS

- Implement each feature incrementally
- Each feature must correspond to a separate Git commit
- Each step must result in a working application

OUTPUT

- Provide full project structure
- Include all React components and files
