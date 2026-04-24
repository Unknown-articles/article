# Todo List App

A simple todo list application built with React, TypeScript, and Vite.

## Features

- Add tasks with title and optional due date
- Tasks are marked as "late" if the due date has passed and the task is not completed
- Toggle task completion status
- Delete tasks
- Inline editing of task titles
- Filter tasks by status (all, pending, completed, late) with count badges
- Action log recording all user actions
- Undo and redo for task changes (Ctrl+Z / Ctrl+Shift+Z)
- Drag-and-drop reordering of tasks (desktop only)
- Touch gesture support for mobile:
  - Swipe left or right on task card to delete (horizontal displacement >100px, undoable)
  - Tap on task card body to toggle completion (displacement <10px, time <200ms, undoable)
- Data persistence using localStorage
- Responsive design for mobile and desktop
- Form validation: title is required
- Auto-focus on title input after submission

## Getting Started

### Prerequisites

- Node.js (version 20.19+, 22.12+)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App

Start the development server:
```bash
npm run dev
```

The app will run on http://localhost:5173/

### Building for Production

```bash
npm run build
```

## Project Structure

- `src/App.tsx` - Main application component
- `src/App.css` - Styles for the app
- `src/main.tsx` - Entry point
- `src/index.css` - Global styles

## Technologies Used

- React 18
- TypeScript
- Vite
- ESLint
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
