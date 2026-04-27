import { useTaskManager } from './hooks/useTaskManager';
import { useKeyboard } from './hooks/useKeyboard';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import Filters from './components/Filters';
import ActionLog from './components/ActionLog';

export default function App() {
  const {
    tasks,
    filter,
    actionLog,
    canUndo,
    canRedo,
    counts,
    addTask,
    editTask,
    deleteTask,
    toggleTask,
    reorderTasks,
    setFilter,
    undo,
    redo,
  } = useTaskManager();

  useKeyboard({ undo, redo });

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">To-Do List</h1>
        <div className="undo-redo">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="btn btn-small"
            title="Undo (Ctrl+Z)"
          >
            ↩ Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="btn btn-small"
            title="Redo (Ctrl+Shift+Z)"
          >
            ↪ Redo
          </button>
        </div>
      </header>

      <main className="app-main">
        <TaskForm onAdd={addTask} />
        <Filters current={filter} counts={counts} onSelect={setFilter} />
        <TaskList
          tasks={tasks}
          onToggle={toggleTask}
          onEdit={editTask}
          onDelete={deleteTask}
          onReorder={reorderTasks}
        />
      </main>

      <ActionLog entries={actionLog} />
    </div>
  );
}
