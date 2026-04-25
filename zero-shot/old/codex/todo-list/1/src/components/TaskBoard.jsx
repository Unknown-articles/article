import { useState } from 'react';
import { TaskFilters } from './TaskFilters';
import { TaskForm } from './TaskForm';
import { TaskList } from './TaskList';

export function TaskBoard({
  activeFilter,
  completedCount,
  lateCount,
  onCreateTask,
  onDeleteTask,
  onFilterChange,
  onReorderTasks,
  onRedo,
  onToggleTask,
  onUndo,
  onUpdateTask,
  redoDisabled,
  tasks,
  totalCount,
  undoDisabled,
}) {
  const [editingTaskId, setEditingTaskId] = useState(null);

  const editingTask = tasks.find((task) => task.id === editingTaskId) ?? null;

  const handleSubmit = (values) => {
    if (editingTask) {
      onUpdateTask(editingTask.id, {
        ...editingTask,
        ...values,
      });
      setEditingTaskId(null);
      return;
    }

    onCreateTask(values);
  };

  const handleEditTask = (taskId) => {
    setEditingTaskId(taskId);
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
  };

  return (
    <section className="panel task-board-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Tasks</p>
          <h2>Keep the next move visible</h2>
        </div>
        <div className="board-controls">
          <span className="metric-pill">{totalCount} total</span>
          <span className="metric-pill metric-pill-success">{completedCount} done</span>
          <span className="metric-pill metric-pill-warning">{lateCount} late</span>
          <button
            className="ghost-button history-button"
            disabled={undoDisabled}
            onClick={onUndo}
            type="button"
          >
            Undo
          </button>
          <button
            className="ghost-button history-button"
            disabled={redoDisabled}
            onClick={onRedo}
            type="button"
          >
            Redo
          </button>
        </div>
      </div>
      <TaskForm
        editingTask={editingTask}
        onCancel={handleCancelEdit}
        onSubmit={handleSubmit}
      />
      <TaskFilters activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <TaskList
        onDeleteTask={onDeleteTask}
        onEditTask={handleEditTask}
        onReorderTasks={onReorderTasks}
        onToggleTask={onToggleTask}
        tasks={tasks}
      />
    </section>
  );
}
