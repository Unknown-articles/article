# Todo List – E2E Test Suite

Playwright-based end-to-end tests that validate every requirement from `prompt.md` against the app running on **http://localhost:3001**.

## Requirements Coverage

| Suite | File | Requirements tested |
|-------|------|---------------------|
| 0 | `00-requirements-check` | App accessible, React root, basic UI present |
| 1 | `01-task-model` | id, title, completed, date, createdAt, late state |
| 2 | `02-task-management` | Create, Edit, Delete, Complete/Uncomplete |
| 3 | `03-filters` | All / Completed / Pending / Late, dynamic counts |
| 4 | `04-drag-drop` | Drag-and-drop reordering, order persisted |
| 5 | `05-mobile-gestures` | Responsive UI, tap-to-complete, swipe-to-delete |
| 6 | `06-undo-redo` | Ctrl+Z undo, Ctrl+Shift+Z redo, multi-step |
| 7 | `07-action-log` | Visible log, type, timestamp, multi-entries |
| 8 | `08-persistence` | localStorage save/load, reload survival |

## Setup

```bash
npm install
npx playwright install chromium
```

## Running tests

```bash
# All tests (headless)
npm test

# With visible browser
npm run test:headed

# Interactive UI mode
npm run test:ui

# Open HTML report after run
npm run test:report
```

## Projects

- **Desktop Chrome** – full feature tests
- **Mobile Chrome** (Pixel 5) – responsive + gesture tests

## Notes

- Tests are order-independent: each clears `localStorage` in `beforeEach`.
- The helpers in `tests/helpers.js` use resilient selectors so they work with different class naming conventions.
- If a test is skipped it means a required DOM feature (e.g., bounding box) was not available — check the app markup.
