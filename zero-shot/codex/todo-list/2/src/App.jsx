import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'late', label: 'Late' }
];

const todayValue = () => new Date().toISOString().slice(0, 10);
const isLate = (task) => Boolean(task.date) && !task.completed && task.date < todayValue();

const matchesFilter = (task, filter) => {
  if (filter === 'completed') return task.completed;
  if (filter === 'pending') return !task.completed;
  if (filter === 'late') return isLate(task);
  return true;
};

const createTask = (title, date) => ({
  id: crypto.randomUUID(),
  title: title.trim(),
  completed: false,
  date,
  createdAt: new Date().toISOString()
});

const createLogEntry = (type, description, payload = null) => ({
  type,
  description,
  timestamp: new Date().toISOString(),
  payload
});

const readStoredTasks = () => {
  try {
    const storedTasks = window.localStorage.getItem('tasks');
    if (!storedTasks) return [];
    const parsedTasks = JSON.parse(storedTasks);
    return Array.isArray(parsedTasks) ? parsedTasks : [];
  } catch {
    return [];
  }
};

function TaskForm({ onAddTask }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayValue());
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    onAddTask(createTask(title, date));
    setTitle('');
    setDate(todayValue());
    inputRef.current?.focus();
  };

  return (
    <form className="task-form" data-testid="task-form" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        data-testid="task-input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add a task"
        aria-label="Task title"
      />
      <input
        data-testid="task-date-input"
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        aria-label="Due date"
      />
      <button data-testid="task-submit" type="submit">
        <Plus size={18} aria-hidden="true" />
        Add
      </button>
    </form>
  );
}

function TaskItem({ task, onDeleteTask, onDragEnd, onDragOverTask, onDragStartTask, onDropTask, onEditTask, onToggleTask }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const editInputRef = useRef(null);
  const touchRef = useRef({ startX: 0, startY: 0, moved: false });
  const late = isLate(task);

  useEffect(() => {
    if (isEditing) editInputRef.current?.focus();
  }, [isEditing]);

  const cancelEdit = () => {
    setDraftTitle(task.title);
    setIsEditing(false);
  };

  const saveEdit = (event) => {
    event.preventDefault();
    const nextTitle = draftTitle.trim();
    if (!nextTitle) return;
    onEditTask(task.id, nextTitle);
    setIsEditing(false);
  };

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    touchRef.current = { startX: touch.clientX, startY: touch.clientY, moved: false };
  };

  const handleTouchMove = (event) => {
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;
    if (Math.abs(deltaX) > 12 || Math.abs(deltaY) > 12) touchRef.current.moved = true;
  };

  const handleTouchEnd = (event) => {
    if (isEditing || event.target.closest('button, input')) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;
    if (Math.abs(deltaX) > 100 && Math.abs(deltaX) > Math.abs(deltaY)) {
      onDeleteTask(task.id);
      return;
    }
    if (!touchRef.current.moved) onToggleTask(task.id);
  };

  return (
    <article
      className={`task-card${task.completed ? ' completed' : ''}${late ? ' late' : ''}`}
      data-testid="task-item"
      data-task-id={task.id}
      data-completed={String(task.completed)}
      data-late={String(late)}
      onDragOver={(event) => onDragOverTask(event, task.id)}
      onDrop={(event) => onDropTask(event, task.id)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <button
        className="drag-handle"
        data-testid="task-drag-handle"
        type="button"
        aria-label="Drag task"
        draggable="true"
        onDragStart={(event) => onDragStartTask(event, task.id)}
        onDragEnd={onDragEnd}
      >
        <GripVertical size={20} aria-hidden="true" />
      </button>
      <button
        className="task-check"
        data-testid="task-checkbox"
        type="button"
        role="checkbox"
        aria-checked={String(task.completed)}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        onClick={() => onToggleTask(task.id)}
      >
        {task.completed && <Check size={17} aria-hidden="true" />}
      </button>
      <div className="task-content">
        {isEditing ? (
          <form className="inline-edit" onSubmit={saveEdit}>
            <input
              ref={editInputRef}
              data-testid="inline-edit-input"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') cancelEdit();
              }}
              aria-label="Edit task title"
            />
            <button data-testid="inline-edit-save" type="submit">
              Save
            </button>
            <button data-testid="inline-edit-cancel" type="button" onClick={cancelEdit}>
              <X size={16} aria-hidden="true" />
              Cancel
            </button>
          </form>
        ) : (
          <>
            <h2 data-testid="task-title">{task.title}</h2>
            <p>
              Due {task.date || 'unscheduled'} · Created {new Date(task.createdAt).toLocaleDateString()}
            </p>
          </>
        )}
      </div>
      <div className="task-actions">
        <button data-testid="task-edit-btn" type="button" onClick={() => setIsEditing(true)} aria-label="Edit task">
          <Pencil size={18} aria-hidden="true" />
        </button>
        <button data-testid="task-delete-btn" type="button" onClick={() => onDeleteTask(task.id)} aria-label="Delete task">
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function ActionLog({ entries }) {
  return (
    <aside className="action-log" data-testid="action-log" aria-label="Action log">
      <div className="log-header">
        <h2>Action Log</h2>
        <span>{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="empty">No actions yet.</p>
      ) : (
        entries.map((entry) => (
          <div className="log-entry" data-testid="log-entry" key={`${entry.timestamp}-${entry.type}`}>
            <div>
              <strong data-testid="log-type">{entry.type}</strong>
              <p>{entry.description}</p>
            </div>
            <time data-testid="log-timestamp" dateTime={entry.timestamp}>
              {entry.timestamp}
            </time>
          </div>
        ))
      )}
    </aside>
  );
}

export function App() {
  const [tasks, setTasks] = useState(readStoredTasks);
  const [filter, setFilter] = useState('all');
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [pastTasks, setPastTasks] = useState([]);
  const [futureTasks, setFutureTasks] = useState([]);
  const [actionLog, setActionLog] = useState([]);

  const completedCount = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);
  const filterCounts = useMemo(
    () => ({
      all: tasks.length,
      pending: tasks.filter((task) => !task.completed).length,
      completed: completedCount,
      late: tasks.filter(isLate).length
    }),
    [completedCount, tasks]
  );
  const visibleTasks = useMemo(() => tasks.filter((task) => matchesFilter(task, filter)), [filter, tasks]);

  useEffect(() => {
    window.localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  const logAction = useCallback((type, description, payload = null) => {
    setActionLog((current) => [createLogEntry(type, description, payload), ...current]);
  }, []);

  const applyTaskChange = useCallback(
    (nextTasks, type, description, payload = null) => {
      setPastTasks((current) => [tasks, ...current]);
      setFutureTasks([]);
      setTasks(nextTasks);
      logAction(type, description, payload);
    },
    [logAction, tasks]
  );

  const addTask = (task) => applyTaskChange([task, ...tasks], 'ADD_TASK', `Added "${task.title}"`, { task });
  const deleteTask = (id) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    applyTaskChange(
      tasks.filter((item) => item.id !== id),
      'DELETE_TASK',
      `Deleted "${task.title}"`,
      { id }
    );
  };
  const toggleTask = (id) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    applyTaskChange(
      tasks.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)),
      'TOGGLE_TASK',
      `${task.completed ? 'Reopened' : 'Completed'} "${task.title}"`,
      { id, completed: !task.completed }
    );
  };
  const editTask = (id, title) => {
    const task = tasks.find((item) => item.id === id);
    if (!task || task.title === title) return;
    applyTaskChange(
      tasks.map((item) => (item.id === id ? { ...item, title } : item)),
      'EDIT_TASK',
      `Renamed "${task.title}" to "${title}"`,
      { id, title }
    );
  };
  const reorderTasks = (sourceId, targetId) => {
    if (!sourceId || sourceId === targetId) return;
    const sourceIndex = tasks.findIndex((task) => task.id === sourceId);
    const targetIndex = tasks.findIndex((task) => task.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const nextTasks = [...tasks];
    const [movedTask] = nextTasks.splice(sourceIndex, 1);
    nextTasks.splice(targetIndex, 0, movedTask);
    applyTaskChange(nextTasks, 'REORDER', `Moved "${movedTask.title}"`, { sourceId, targetId });
  };

  const selectFilter = (nextFilter) => {
    if (nextFilter === filter) return;
    setFilter(nextFilter);
    logAction('SET_FILTER', `Set filter to ${nextFilter}`, { filter: nextFilter });
  };

  const undo = useCallback(() => {
    if (pastTasks.length === 0) return;
    const [previousTasks, ...remainingPast] = pastTasks;
    setFutureTasks((current) => [tasks, ...current]);
    setPastTasks(remainingPast);
    setTasks(previousTasks);
    logAction('UNDO', 'Undid the last task change', null);
  }, [logAction, pastTasks, tasks]);

  const redo = useCallback(() => {
    if (futureTasks.length === 0) return;
    const [nextTasks, ...remainingFuture] = futureTasks;
    setPastTasks((current) => [tasks, ...current]);
    setFutureTasks(remainingFuture);
    setTasks(nextTasks);
    logAction('REDO', 'Redid the next task change', null);
  }, [futureTasks, logAction, tasks]);

  const handleDragStart = (event, id) => {
    setDraggedTaskId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (event, targetId) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('text/plain') || draggedTaskId;
    reorderTasks(sourceId, targetId);
    setDraggedTaskId(null);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!event.ctrlKey || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [redo, undo]);

  return (
    <main className="app-shell">
      <section className="panel">
        <div className="app-header">
          <div>
            <p className="eyebrow">Today</p>
            <h1>To-Do List</h1>
          </div>
          <strong>{completedCount}/{tasks.length}</strong>
        </div>
        <TaskForm onAddTask={addTask} />
        <div className="filters" aria-label="Task filters">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              data-testid={`filter-${item.id}`}
              type="button"
              aria-pressed={String(filter === item.id)}
              onClick={() => selectFilter(item.id)}
            >
              {item.label}
              <span data-testid={`filter-count-${item.id}`}>{filterCounts[item.id]}</span>
            </button>
          ))}
        </div>
        <div className="task-list" data-testid="task-list">
          {visibleTasks.length === 0 ? (
            <p className="empty">No tasks yet.</p>
          ) : (
            visibleTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onDeleteTask={deleteTask}
                onDragEnd={() => setDraggedTaskId(null)}
                onDragOverTask={handleDragOver}
                onDragStartTask={handleDragStart}
                onDropTask={handleDrop}
                onEditTask={editTask}
                onToggleTask={toggleTask}
              />
            ))
          )}
        </div>
        <ActionLog entries={actionLog} />
      </section>
    </main>
  );
}
