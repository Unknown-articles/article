# To-Do List Application

A modern React-based to-do list application with drag-and-drop reordering, undo/redo functionality, and mobile-friendly gestures.

## Features

- **Task Management**: Create, edit, delete, and toggle completion of tasks
- **Due Dates**: Assign due dates to tasks with automatic "late" detection
- **Filters**: Filter tasks by All, Completed, Pending, or Late status
- **Drag-and-Drop**: Reorder tasks via drag-and-drop
- **Undo/Redo**: Full undo/redo system with keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
- **Action Log**: Visible log of all user actions
- **Persistence**: Tasks saved to localStorage
- **Mobile Gestures**: Swipe to delete, tap to complete
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the project directory
3. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

## Usage

### Adding Tasks
- Enter a task title and select a due date
- Press Enter or click "Add Task"

### Editing Tasks
- Click on the task title to enter inline edit mode
- Press Enter to save, Escape to cancel

### Completing Tasks
- Click the checkbox or tap the task on mobile

### Deleting Tasks
- Click the delete button or swipe left on mobile

### Reordering Tasks
- Drag the handle (⋮⋮) to reorder tasks

### Filtering
- Use the filter buttons to view specific task types

### Undo/Redo
- Press Ctrl+Z to undo, Ctrl+Shift+Z to redo

## Project Structure

```
src/
├── components/
│   ├── ActionLog.tsx
│   ├── Filters.tsx
│   ├── TaskForm.tsx
│   ├── TaskItem.tsx
│   ├── TaskList.tsx
│   └── TodoApp.tsx
├── TodoContext.tsx
├── store.ts
├── types.ts
├── App.tsx
├── index.css
└── main.tsx
```

## Technologies Used

- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **@dnd-kit** for drag-and-drop functionality
- **date-fns** for date handling

## Testing

The application includes comprehensive data-testid attributes for all interactive elements, making it ready for automated testing.