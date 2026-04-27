import { useEffect, useMemo } from 'react'
import { useTaskState } from './hooks/useTaskState'
import { isTaskLate } from './utils/taskHelpers'
import TaskForm from './components/TaskForm'
import TaskList from './components/TaskList'
import Filters from './components/Filters'
import ActionLog from './components/ActionLog'
import './App.css'

function filterTasks(tasks, filter) {
  switch (filter) {
    case 'pending': return tasks.filter(t => !t.completed)
    case 'completed': return tasks.filter(t => t.completed)
    case 'late': return tasks.filter(t => isTaskLate(t))
    default: return tasks
  }
}

export default function App() {
  const {
    tasks,
    filter,
    actionLog,
    canUndo,
    canRedo,
    addTask,
    editTask,
    deleteTask,
    toggleTask,
    reorderTasks,
    setFilter,
    undo,
    redo,
  } = useTaskState()

  useEffect(() => {
    function handleKeyDown(e) {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  const visibleTasks = useMemo(() => filterTasks(tasks, filter), [tasks, filter])

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">To-Do List</h1>
        <div className="undo-redo">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
          >
            ↩ Undo
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
          >
            ↪ Redo
          </button>
        </div>
      </header>

      <main className="app-main">
        <section className="app-left">
          <TaskForm onAdd={addTask} />
          <Filters tasks={tasks} current={filter} onFilter={setFilter} />
          {visibleTasks.length === 0 ? (
            <p className="empty-msg">No tasks to show.</p>
          ) : (
            <TaskList
              tasks={visibleTasks}
              onToggle={toggleTask}
              onEdit={editTask}
              onDelete={deleteTask}
              onReorder={reorderTasks}
            />
          )}
        </section>

        <aside className="app-right">
          <ActionLog log={actionLog} />
        </aside>
      </main>
    </div>
  )
}
