import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionLog } from './components/ActionLog';
import { FilterBar } from './components/FilterBar';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
import { createTask, isTaskLate, loadStoredTasks, reorderTasks } from './utils/tasks';

const STORAGE_KEY = 'tasks';
const FILTERS = ['all', 'pending', 'completed', 'late'];

export default function App() {
  const [history, setHistory] = useState(() => ({
    past: [],
    present: {
      tasks: loadStoredTasks(STORAGE_KEY),
      filter: 'all',
    },
    future: [],
  }));
  const [actionLog, setActionLog] = useState([]);
  const presentRef = useRef(history.present);
  const { tasks, filter } = history.present;

  useEffect(() => {
    presentRef.current = history.present;
  }, [history.present]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    function handleKeyboardShortcuts(event) {
      const isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
      const isRedo = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z';

      if (isUndo) {
        event.preventDefault();
        handleUndo();
      }

      if (isRedo) {
        event.preventDefault();
        handleRedo();
      }
    }

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [history.future.length, history.past.length]);

  const filterCounts = useMemo(
    () => ({
      all: tasks.length,
      pending: tasks.filter((task) => !task.completed).length,
      completed: tasks.filter((task) => task.completed).length,
      late: tasks.filter((task) => isTaskLate(task)).length,
    }),
    [tasks],
  );

  const visibleTasks = useMemo(() => {
    switch (filter) {
      case 'completed':
        return tasks.filter((task) => task.completed);
      case 'pending':
        return tasks.filter((task) => !task.completed);
      case 'late':
        return tasks.filter((task) => isTaskLate(task));
      case 'all':
      default:
        return tasks;
    }
  }, [filter, tasks]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      completed: filterCounts.completed,
      pending: filterCounts.pending,
      late: filterCounts.late,
    };
  }, [filterCounts, tasks.length]);

  function appendLog(type, description, payload) {
    setActionLog((currentLog) => [
      {
        type,
        description,
        timestamp: new Date().toISOString(),
        payload,
      },
      ...currentLog,
    ]);
  }

  function commitChange(updater, logEntry) {
    const currentPresent = presentRef.current;
    const nextPresent = updater(currentPresent);
    if (nextPresent === currentPresent) {
      return;
    }

    setHistory((currentHistory) => ({
      past: [...currentHistory.past, currentHistory.present],
      present: nextPresent,
      future: [],
    }));

    appendLog(logEntry.type, logEntry.description, logEntry.payload);
  }

  function handleCreateTask({ title, date }) {
    const newTask = createTask({ title, date });
    commitChange(
      (currentPresent) => ({
        ...currentPresent,
        tasks: [newTask, ...currentPresent.tasks],
      }),
      {
        type: 'ADD_TASK',
        description: `Added "${newTask.title}"`,
        payload: { taskId: newTask.id, title, date },
      },
    );
  }

  function handleToggleTask(taskId) {
    const taskToToggle = presentRef.current.tasks.find((task) => task.id === taskId);
    if (!taskToToggle) {
      return;
    }

    const updatedTask = { ...taskToToggle, completed: !taskToToggle.completed };
    commitChange(
      (currentPresent) => ({
        ...currentPresent,
        tasks: currentPresent.tasks.map((task) => (task.id === taskId ? updatedTask : task)),
      }),
      {
        type: 'TOGGLE_TASK',
        description: `${updatedTask.completed ? 'Completed' : 'Reopened'} "${updatedTask.title}"`,
        payload: { taskId, completed: updatedTask.completed },
      },
    );
  }

  function handleDeleteTask(taskId) {
    const taskToDelete = presentRef.current.tasks.find((task) => task.id === taskId);
    if (!taskToDelete) {
      return;
    }

    commitChange(
      (currentPresent) => ({
        ...currentPresent,
        tasks: currentPresent.tasks.filter((task) => task.id !== taskId),
      }),
      {
        type: 'DELETE_TASK',
        description: `Deleted "${taskToDelete.title}"`,
        payload: { taskId },
      },
    );
  }

  function handleEditTask(taskId, nextTitle) {
    const taskToEdit = presentRef.current.tasks.find((task) => task.id === taskId);
    if (!taskToEdit || taskToEdit.title === nextTitle) {
      return;
    }

    const updatedTask = { ...taskToEdit, title: nextTitle };
    commitChange(
      (currentPresent) => ({
        ...currentPresent,
        tasks: currentPresent.tasks.map((task) => (task.id === taskId ? updatedTask : task)),
      }),
      {
        type: 'EDIT_TASK',
        description: `Renamed task to "${nextTitle}"`,
        payload: { taskId, title: nextTitle },
      },
    );
  }

  function handleSetFilter(nextFilter) {
    if (!FILTERS.includes(nextFilter) || nextFilter === filter) {
      return;
    }

    commitChange(
      (currentPresent) => ({
        ...currentPresent,
        filter: nextFilter,
      }),
      {
        type: 'SET_FILTER',
        description: `Switched view to ${nextFilter}`,
        payload: { filter: nextFilter },
      },
    );
  }

  function handleReorderTasks(sourceTaskId, targetTaskId) {
    if (sourceTaskId === targetTaskId) {
      return;
    }

    const reorderedTasks = reorderTasks(presentRef.current.tasks, sourceTaskId, targetTaskId);
    if (reorderedTasks === presentRef.current.tasks) {
      return;
    }

    commitChange(
      (currentPresent) => ({
        ...currentPresent,
        tasks: reorderedTasks,
      }),
      {
        type: 'REORDER',
        description: 'Reordered tasks',
        payload: { sourceTaskId, targetTaskId },
      },
    );
  }

  function handleUndo() {
    if (history.past.length === 0) {
      return;
    }

    const previousPresent = history.past[history.past.length - 1];
    setHistory({
      past: history.past.slice(0, -1),
      present: previousPresent,
      future: [history.present, ...history.future],
    });
    appendLog('UNDO', 'Undid the last change', null);
  }

  function handleRedo() {
    if (history.future.length === 0) {
      return;
    }

    const nextPresent = history.future[0];
    setHistory({
      past: [...history.past, history.present],
      present: nextPresent,
      future: history.future.slice(1),
    });
    appendLog('REDO', 'Redid the last undone change', null);
  }

  return (
    <main className="app-shell">
      <div className="app-layout">
        <section className="panel panel-hero">
          <p className="eyebrow">Momentum Tasks</p>
          <h1>Plan boldly. Finish calmly.</h1>
          <p className="hero-copy">
            A responsive to-do workspace for keeping due dates, progress, and priorities in one
            focused view.
          </p>

          <dl className="stats-grid">
            <div className="stat-card">
              <dt>Total</dt>
              <dd>{stats.total}</dd>
            </div>
            <div className="stat-card">
              <dt>Pending</dt>
              <dd>{stats.pending}</dd>
            </div>
            <div className="stat-card">
              <dt>Completed</dt>
              <dd>{stats.completed}</dd>
            </div>
            <div className="stat-card late-card">
              <dt>Late</dt>
              <dd>{stats.late}</dd>
            </div>
          </dl>
        </section>

        <section className="panel panel-main">
          <TaskForm onSubmit={handleCreateTask} />
          <FilterBar
            counts={filterCounts}
            currentFilter={filter}
            onRedo={handleRedo}
            onSetFilter={handleSetFilter}
            onUndo={handleUndo}
          />
          <TaskList
            onDeleteTask={handleDeleteTask}
            onEditTask={handleEditTask}
            onReorderTasks={handleReorderTasks}
            onToggleTask={handleToggleTask}
            tasks={visibleTasks}
          />
          <ActionLog actionLog={actionLog} />
        </section>
      </div>
    </main>
  );
}
