# To-Do List Application

A modern React-based To-Do List application with drag-and-drop, undo/redo, filters, and mobile-friendly gestures.

## Features

- **Task Management**: Create, edit, delete, and mark tasks as completed
- **Inline Editing**: Edit tasks directly in the list
- **Drag-and-Drop**: Reorder tasks via drag-and-drop
- **Filters**: Filter by All, Completed, Pending, Late tasks
- **Undo/Redo**: Full undo/redo functionality with Ctrl+Z / Ctrl+Shift+Z
- **Action Log**: Visible log of all user actions
- **Persistence**: Tasks saved to localStorage
- **Mobile Gestures**: Swipe to delete, tap to complete
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

- `src/App.jsx` - Main application component
- `src/components/` - React components
  - `TaskForm.jsx` - Form for adding tasks
  - `TaskList.jsx` - List of tasks
  - `TaskItem.jsx` - Individual task item
  - `Filters.jsx` - Filter buttons
  - `ActionLog.jsx` - Action log display
- `src/App.css` - Styles

## Technologies Used

- React 19
- Vite
- Modern JavaScript (ES6+)
- HTML5 Drag and Drop API
- Touch Events for mobile
- localStorage for persistence
