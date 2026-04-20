import { TaskProvider, useTasks } from './context/TaskContext'
import TaskForm from './components/TaskForm'
import FilterBar from './components/FilterBar'
import TaskList from './components/TaskList'
import ActionLog from './components/ActionLog'

function AppShell() {
  const { undo, redo, canUndo, canRedo } = useTasks()

  return (
    <div className="app">
      <header className="header">
        <h1>Todo List</h1>
        <div className="header-actions">
          <button
            className="btn-icon"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >↩</button>
          <button
            className="btn-icon"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >↪</button>
        </div>
      </header>

      <main>
        <TaskForm />
        <FilterBar />
        <TaskList />
        <ActionLog />
        <p className="kb-hint">
          <kbd>Ctrl+Z</kbd> undo &nbsp; <kbd>Ctrl+Shift+Z</kbd> redo
        </p>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <TaskProvider>
      <AppShell />
    </TaskProvider>
  )
}
