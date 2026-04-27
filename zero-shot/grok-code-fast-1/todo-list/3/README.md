# To-Do List Application

A modern, responsive To-Do List application built with React, TypeScript, and Vite.

## Features

- **Task Management**: Create, edit, delete, and mark tasks as completed
- **Inline Editing**: Edit tasks directly in the list with keyboard shortcuts (Enter to save, Escape to cancel)
- **Drag-and-Drop Reordering**: Reorder tasks via drag-and-drop
- **Filters**: Filter tasks by All, Pending, Completed, or Late with dynamic counts
- **Undo/Redo**: Full undo/redo functionality with Ctrl+Z and Ctrl+Shift+Z
- **Action Log**: Visible log of all user actions
- **Persistence**: Tasks saved to localStorage
- **Mobile-Friendly**: Responsive design with touch gestures (swipe to delete, tap to complete)
- **Accessibility**: Proper ARIA attributes and keyboard navigation

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:5174](http://localhost:5174) in your browser.

## Building for Production

```bash
npm run build
```

## Technologies Used

- React 19
- TypeScript
- Vite
- @dnd-kit for drag-and-drop
- localStorage for persistence

## Project Structure

```
src/
├── components/
│   ├── ActionLog.tsx
│   ├── Filters.tsx
│   ├── InlineEditForm.tsx
│   ├── TaskForm.tsx
│   ├── TaskItem.tsx
│   └── TaskList.tsx
├── App.tsx
├── App.css
├── main.tsx
├── reducer.ts
├── types.ts
└── utils.ts
```
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
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

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
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
