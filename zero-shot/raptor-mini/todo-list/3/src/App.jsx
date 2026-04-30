import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'tasks';
const FILTERS = ['All', 'Pending', 'Completed', 'Late'];
const ACTION_TYPES = {
  ADD_TASK: 'ADD_TASK',
  EDIT_TASK: 'EDIT_TASK',
  DELETE_TASK: 'DELETE_TASK',
  TOGGLE_TASK: 'TOGGLE_TASK',
  REORDER: 'REORDER',
  SET_FILTER: 'SET_FILTER',
  UNDO: 'UNDO',
  REDO: 'REDO',
};

function createAction(type, description, payload = null) {
  return {
    type,
    description,
    timestamp: new Date().toISOString(),
    payload,
  };
}

function getInitialTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((task) => ({
      ...task,
      createdAt: task.createdAt || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function makeTask({ title, date }) {
  return {
    id: crypto.randomUUID(),
    title,
    completed: false,
    date,
    createdAt: new Date().toISOString(),
  };
}

function isLate(task) {
  if (task.completed) return false;
  if (!task.date) return false;
  return new Date(task.date).getTime() < new Date().setHours(0, 0, 0, 0);
}

function filterTasks(tasks, filter) {
  switch (filter) {
    case 'Completed':
      return tasks.filter((task) => task.completed);
    case 'Pending':
      return tasks.filter((task) => !task.completed && !isLate(task));
    case 'Late':
      return tasks.filter((task) => isLate(task));
    default:
      return tasks;
  }
}

function App() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('All');
  const [actionLog, setActionLog] = useState([]);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [draggingId, setDraggingId] = useState(null);
  const touchState = useRef({ startX: 0, startY: 0, activeId: null, swipeTriggered: false, timeoutId: null });
  const inputRef = useRef(null);

  useEffect(() => {
    setTasks(getInitialTasks());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.ctrlKey && !event.shiftKey && event.key === 'z') {
        event.preventDefault();
        handleUndo();
      }
      if (event.ctrlKey && event.shiftKey && event.key === 'Z') {
        event.preventDefault();
        handleRedo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [history, future, tasks]);

  const filteredTasks = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);

  const counts = useMemo(() => ({
    All: tasks.length,
    Completed: tasks.filter((task) => task.completed).length,
    Pending: tasks.filter((task) => !task.completed && !isLate(task)).length,
    Late: tasks.filter((task) => isLate(task)).length,
  }), [tasks]);

  function pushHistory(nextTasks) {
    setHistory((current) => [...current, tasks]);
    setFuture([]);
    setTasks(nextTasks);
  }

  function logAction(type, description, payload = null) {
    setActionLog((current) => [createAction(type, description, payload), ...current].slice(0, 50));
  }

  function handleAddTask(event) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const task = makeTask({ title: trimmedTitle, date });
    pushHistory([task, ...tasks]);
    logAction(ACTION_TYPES.ADD_TASK, `Added task "${task.title}"`, { task });
    setTitle('');
    setDate('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  function handleDeleteTask(taskId) {
    const nextTasks = tasks.filter((task) => task.id !== taskId);
    pushHistory(nextTasks);
    logAction(ACTION_TYPES.DELETE_TASK, `Deleted task`, { id: taskId });
    if (editing === taskId) {
      setEditing(null);
    }
  }

  function handleToggleTask(taskId) {
    const nextTasks = tasks.map((task) => task.id === taskId
      ? { ...task, completed: !task.completed }
      : task);
    pushHistory(nextTasks);
    const toggled = tasks.find((task) => task.id === taskId);
    logAction(ACTION_TYPES.TOGGLE_TASK, `${toggled?.completed ? 'Marked incomplete' : 'Marked complete'} task`, { id: taskId });
  }

  function handleStartEdit(task) {
    setEditing(task.id);
    setEditValue(task.title);
  }

  function handleSaveEdit(taskId) {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    const nextTasks = tasks.map((task) => task.id === taskId ? { ...task, title: trimmed } : task);
    pushHistory(nextTasks);
    logAction(ACTION_TYPES.EDIT_TASK, `Edited task title`, { id: taskId, title: trimmed });
    setEditing(null);
  }

  function handleCancelEdit() {
    setEditing(null);
    setEditValue('');
  }

  function handleFilterSelection(selected) {
    setFilter(selected);
    logAction(ACTION_TYPES.SET_FILTER, `Filter set to ${selected}`, { filter: selected });
  }

  function handleUndo() {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const nextHistory = history.slice(0, -1);
    setHistory(nextHistory);
    setFuture((current) => [tasks, ...current]);
    setTasks(previous);
    logAction(ACTION_TYPES.UNDO, `Undo action`, null);
  }

  function handleRedo() {
    if (future.length === 0) return;
    const next = future[0];
    const nextFuture = future.slice(1);
    setFuture(nextFuture);
    setHistory((current) => [...current, tasks]);
    setTasks(next);
    logAction(ACTION_TYPES.REDO, `Redo action`, null);
  }

  function handleDragStart(event, taskId) {
    setDraggingId(taskId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', taskId);
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  function handleDrop(event, overTaskId) {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === overTaskId) return;
    const draggedIndex = tasks.findIndex((task) => task.id === draggedId);
    const overIndex = tasks.findIndex((task) => task.id === overTaskId);
    if (draggedIndex === -1 || overIndex === -1) return;
    const nextTasks = [...tasks];
    const [moved] = nextTasks.splice(draggedIndex, 1);
    nextTasks.splice(overIndex, 0, moved);
    pushHistory(nextTasks);
    logAction(ACTION_TYPES.REORDER, `Reordered tasks`, { from: draggedIndex, to: overIndex });
    setDraggingId(null);
  }

  function onTouchStart(event, taskId) {
    const touch = event.touches[0];
    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      activeId: taskId,
      swipeTriggered: false,
      timeoutId: null,
    };
  }

  function onTouchMove(event) {
    const touch = event.touches[0];
    const state = touchState.current;
    if (!state.activeId) return;
    const dx = touch.clientX - state.startX;
    const dy = touch.clientY - state.startY;
    if (Math.abs(dx) > 100 && Math.abs(dx) > Math.abs(dy) && !state.swipeTriggered) {
      state.swipeTriggered = true;
      state.timeoutId = window.setTimeout(() => {
        handleDeleteTask(state.activeId);
        touchState.current.activeId = null;
      }, 200);
    }
  }

  function onTouchEnd(event, taskId) {
    const state = touchState.current;
    if (!state.activeId) return;
    const dx = event.changedTouches[0].clientX - state.startX;
    const dy = event.changedTouches[0].clientY - state.startY;
    if (!state.swipeTriggered && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      handleToggleTask(taskId);
    }
    if (state.timeoutId) {
      window.clearTimeout(state.timeoutId);
    }
    touchState.current = { startX: 0, startY: 0, activeId: null, swipeTriggered: false, timeoutId: null };
  }

  function renderTaskItem(task) {
    const late = isLate(task);
    const isEditing = editing === task.id;
    return (
      <li
        key={task.id}
        data-testid="task-item"
        data-task-id={task.id}
        data-completed={task.completed ? 'true' : 'false'}
        data-late={late ? 'true' : 'false'}
        className={`task-item ${task.completed ? 'completed' : ''} ${late ? 'late' : ''}`}
        draggable
        onDragOver={handleDragOver}
        onDrop={(event) => handleDrop(event, task.id)}
        onTouchStart={(event) => onTouchStart(event, task.id)}
        onTouchMove={onTouchMove}
        onTouchEnd={(event) => onTouchEnd(event, task.id)}
      >
        <button
          className="drag-handle"
          aria-label="Drag task"
          data-testid="task-drag-handle"
          draggable="true"
          onDragStart={(event) => handleDragStart(event, task.id)}
        >
          ☰
        </button>
        <label className="task-main">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => handleToggleTask(task.id)}
            data-testid="task-checkbox"
            aria-checked={task.completed ? 'true' : 'false'}
            aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
          />
          {isEditing ? (
            <form
              className="inline-edit"
              onSubmit={(event) => {
                event.preventDefault();
                handleSaveEdit(task.id);
              }}
            >
              <input
                className="inline-input"
                data-testid="inline-edit-input"
                value={editValue}
                onChange={(event) => setEditValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    handleCancelEdit();
                  }
                }}
                autoFocus
              />
              <div className="inline-actions">
                <button type="submit" data-testid="inline-edit-save">Save</button>
                <button type="button" data-testid="inline-edit-cancel" onClick={handleCancelEdit}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className="task-content">
              <span data-testid="task-title" className="task-title">
                {task.title}
              </span>
              <span className="task-meta">
                Due {task.date || 'No date'} · Created {new Date(task.createdAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </label>
        {!isEditing && (
          <div className="task-actions">
            <button type="button" data-testid="task-edit-btn" onClick={() => handleStartEdit(task)}>
              Edit
            </button>
            <button type="button" data-testid="task-delete-btn" onClick={() => handleDeleteTask(task.id)}>
              Delete
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>To-Do List</h1>
        <p>Responsive task manager with inline editing, drag-and-drop, gestures, filters, undo/redo, and action log.</p>
      </header>

      <section className="task-form-section">
        <form className="task-form" data-testid="task-form" onSubmit={handleAddTask}>
          <div className="form-row">
            <label>
              Task title
              <input
                ref={inputRef}
                type="text"
                data-testid="task-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Add a new task"
                autoComplete="off"
              />
            </label>
            <label>
              Due date
              <input
                type="date"
                data-testid="task-date-input"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
          </div>
          <button type="submit" data-testid="task-submit">Add Task</button>
        </form>
      </section>

      <section className="filters-section">
        {FILTERS.map((name) => (
          <button
            key={name}
            type="button"
            data-testid={`filter-${name.toLowerCase()}`}
            aria-pressed={filter === name ? 'true' : 'false'}
            className={filter === name ? 'active' : ''}
            onClick={() => handleFilterSelection(name)}
          >
            {name}
            <span data-testid={`filter-count-${name.toLowerCase()}`} className="filter-count">
              {counts[name]}
            </span>
          </button>
        ))}
      </section>

      <section className="task-list-section">
        <ul className="task-list" data-testid="task-list">
          {filteredTasks.length > 0 ? filteredTasks.map(renderTaskItem) : (
            <li className="empty-state">No tasks match this filter.</li>
          )}
        </ul>
      </section>

      <section className="action-log-section">
        <h2>Action Log</h2>
        <div className="action-log" data-testid="action-log">
          {actionLog.length === 0 ? (
            <div className="empty-log">No actions yet.</div>
          ) : (
            <ul>
              {actionLog.map((entry, index) => (
                <li key={`${entry.type}-${entry.timestamp}-${index}`} className="log-entry" data-testid="log-entry">
                  <span className="log-type" data-testid="log-type">{entry.type}</span>
                  <span className="log-description">{entry.description}</span>
                  <time className="log-timestamp" data-testid="log-timestamp">{entry.timestamp}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
