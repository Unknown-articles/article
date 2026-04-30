import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'tasks';
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'late', label: 'Late' },
];

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function isLate(task) {
  return Boolean(task.date) && task.date < todayISODate() && !task.completed;
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStoredTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function reorderTasks(tasks, activeId, overId) {
  if (!activeId || !overId || activeId === overId) {
    return tasks;
  }

  const activeIndex = tasks.findIndex((task) => task.id === activeId);
  const overIndex = tasks.findIndex((task) => task.id === overId);

  if (activeIndex === -1 || overIndex === -1) {
    return tasks;
  }

  const nextTasks = [...tasks];
  const [movedTask] = nextTasks.splice(activeIndex, 1);
  nextTasks.splice(overIndex, 0, movedTask);
  return nextTasks;
}

function ActionLog({ actions }) {
  return (
    <aside className="panel action-panel" data-testid="action-log" aria-label="Action log">
      <div className="section-heading">
        <p className="eyebrow">Devtools</p>
        <h2>Action Log</h2>
      </div>
      <div className="log-list">
        {actions.length === 0 ? (
          <p className="muted">No actions yet. The first task usually breaks the seal.</p>
        ) : (
          actions.map((action) => (
            <article className="log-entry" data-testid="log-entry" key={action.id}>
              <strong data-testid="log-type">{action.type}</strong>
              <time data-testid="log-timestamp" dateTime={action.timestamp}>
                {action.timestamp}
              </time>
              <p>{action.description}</p>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}

function FilterBar({ activeFilter, counts, onFilter }) {
  return (
    <div className="filter-bar" aria-label="Task filters">
      {FILTERS.map((filter) => (
        <button
          aria-pressed={activeFilter === filter.id}
          className="filter-button"
          data-testid={`filter-${filter.id}`}
          key={filter.id}
          onClick={() => onFilter(filter.id)}
          type="button"
        >
          <span>{filter.label}</span>
          <span className="count-badge" data-testid={`filter-count-${filter.id}`}>
            {counts[filter.id]}
          </span>
        </button>
      ))}
    </div>
  );
}

function TaskForm({ onAdd }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayISODate());
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      titleRef.current?.focus();
      return;
    }

    onAdd({ title: trimmedTitle, date });
    setTitle('');
    setDate(todayISODate());
    titleRef.current?.focus();
  }

  return (
    <form className="task-form" data-testid="task-form" onSubmit={handleSubmit}>
      <label>
        <span>Task title</span>
        <input
          data-testid="task-input"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ship the tiny thing"
          ref={titleRef}
          required
          type="text"
          value={title}
        />
      </label>
      <label>
        <span>Due date</span>
        <input
          data-testid="task-date-input"
          onChange={(event) => setDate(event.target.value)}
          required
          type="date"
          value={date}
        />
      </label>
      <button className="primary-button" data-testid="task-submit" type="submit">
        Add task
      </button>
    </form>
  );
}

function InlineEditForm({ initialTitle, onCancel, onSave }) {
  const [draft, setDraft] = useState(initialTitle);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmedDraft = draft.trim();

    if (trimmedDraft) {
      onSave(trimmedDraft);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <form className="inline-edit" onSubmit={handleSubmit}>
      <input
        data-testid="inline-edit-input"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        value={draft}
      />
      <button data-testid="inline-edit-save" type="submit">
        Save
      </button>
      <button data-testid="inline-edit-cancel" onClick={onCancel} type="button">
        Cancel
      </button>
    </form>
  );
}

function TaskItem({ task, onDelete, onDragStartTask, onDropTask, onEdit, onToggle }) {
  const [isEditing, setIsEditing] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const touchStartRef = useRef(null);
  const late = isLate(task);

  function handleTouchStart(event) {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setDragOffset(0);
  }

  function handleTouchMove(event) {
    if (!touchStartRef.current) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setDragOffset(Math.max(-130, Math.min(130, deltaX)));
    }
  }

  function handleTouchEnd(event) {
    if (!touchStartRef.current) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    touchStartRef.current = null;
    setDragOffset(0);

    if (Math.abs(deltaX) > 100) {
      window.setTimeout(() => onDelete(task.id), 0);
    }
  }

  function handleCardClick(event) {
    if (event.target.closest('button, input, form')) {
      return;
    }

    onToggle(task.id);
  }

  return (
    <article
      className={`task-card ${task.completed ? 'is-completed' : ''} ${late ? 'is-late' : ''}`}
      data-completed={String(task.completed)}
      data-late={String(late)}
      data-task-id={task.id}
      data-testid="task-item"
      draggable={!isEditing}
      onClick={handleCardClick}
      onDragOver={(event) => event.preventDefault()}
      onDragStart={() => onDragStartTask(task.id)}
      onDrop={() => onDropTask(task.id)}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      style={{ transform: dragOffset ? `translateX(${dragOffset}px)` : undefined }}
    >
      <button
        className="drag-handle"
        data-testid="task-drag-handle"
        draggable
        onDragStart={() => onDragStartTask(task.id)}
        title="Drag to reorder"
        type="button"
      >
        grip
      </button>
      <button
        aria-checked={String(task.completed)}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        className="task-check"
        data-testid="task-checkbox"
        onClick={() => onToggle(task.id)}
        role="checkbox"
        type="button"
      >
        {task.completed ? 'Done' : 'Tap'}
      </button>
      <div className="task-content">
        {isEditing ? (
          <InlineEditForm
            initialTitle={task.title}
            onCancel={() => setIsEditing(false)}
            onSave={(title) => {
              onEdit(task.id, title);
              setIsEditing(false);
            }}
          />
        ) : (
          <h3 data-testid="task-title">{task.title}</h3>
        )}
        <p>
          Due <time dateTime={task.date}>{task.date}</time>
          {late ? <span className="late-pill">Late</span> : null}
        </p>
      </div>
      <div className="task-actions">
        <button data-testid="task-edit-btn" onClick={() => setIsEditing(true)} type="button">
          Edit
        </button>
        <button data-testid="task-delete-btn" onClick={() => onDelete(task.id)} type="button">
          Delete
        </button>
      </div>
    </article>
  );
}

function App() {
  const [tasks, setTasks] = useState(readStoredTasks);
  const [filter, setFilter] = useState('all');
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [actions, setActions] = useState([]);
  const draggedTaskId = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      pending: tasks.filter((task) => !task.completed).length,
      completed: tasks.filter((task) => task.completed).length,
      late: tasks.filter(isLate).length,
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
        return tasks.filter(isLate);
      default:
        return tasks;
    }
  }, [filter, tasks]);

  function logAction(type, description, payload = null) {
    setActions((currentActions) => [
      {
        id: createId(),
        type,
        description,
        timestamp: new Date().toISOString(),
        payload,
      },
      ...currentActions,
    ]);
  }

  function commitTasks(nextTasks, action) {
    setPast((currentPast) => [...currentPast, tasks]);
    setFuture([]);
    setTasks(nextTasks);
    logAction(action.type, action.description, action.payload);
  }

  function addTask({ title, date }) {
    const task = {
      id: createId(),
      title,
      completed: false,
      date,
      createdAt: new Date().toISOString(),
    };

    commitTasks([...tasks, task], {
      type: 'ADD_TASK',
      description: `Added "${title}"`,
      payload: task,
    });
  }

  function editTask(id, title) {
    const nextTasks = tasks.map((task) => (task.id === id ? { ...task, title } : task));
    commitTasks(nextTasks, {
      type: 'EDIT_TASK',
      description: `Renamed task to "${title}"`,
      payload: { id, title },
    });
  }

  function deleteTask(id) {
    const task = tasks.find((candidate) => candidate.id === id);
    const nextTasks = tasks.filter((candidate) => candidate.id !== id);
    commitTasks(nextTasks, {
      type: 'DELETE_TASK',
      description: task ? `Deleted "${task.title}"` : 'Deleted task',
      payload: task ?? { id },
    });
  }

  function toggleTask(id) {
    const nextTasks = tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task,
    );
    const task = nextTasks.find((candidate) => candidate.id === id);
    commitTasks(nextTasks, {
      type: 'TOGGLE_TASK',
      description: task?.completed ? `Completed "${task.title}"` : `Reopened "${task?.title ?? 'task'}"`,
      payload: { id, completed: task?.completed ?? false },
    });
  }

  function setActiveFilter(nextFilter) {
    setFilter(nextFilter);
    logAction('SET_FILTER', `Set filter to ${nextFilter}`, { filter: nextFilter });
  }

  function undo() {
    setPast((currentPast) => {
      if (currentPast.length === 0) {
        return currentPast;
      }

      const previousTasks = currentPast.at(-1);
      setFuture((currentFuture) => [tasks, ...currentFuture]);
      setTasks(previousTasks);
      logAction('UNDO', 'Undid last task state change', null);
      return currentPast.slice(0, -1);
    });
  }

  function redo() {
    setFuture((currentFuture) => {
      if (currentFuture.length === 0) {
        return currentFuture;
      }

      const nextTasks = currentFuture[0];
      setPast((currentPast) => [...currentPast, tasks]);
      setTasks(nextTasks);
      logAction('REDO', 'Redid next task state change', null);
      return currentFuture.slice(1);
    });
  }

  useEffect(() => {
    function handleKeyboard(event) {
      if (!event.ctrlKey || event.key.toLowerCase() !== 'z') {
        return;
      }

      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    }

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  });

  function handleDropTask(overId) {
    const activeId = draggedTaskId.current;
    draggedTaskId.current = null;
    const nextTasks = reorderTasks(tasks, activeId, overId);

    if (nextTasks !== tasks) {
      commitTasks(nextTasks, {
        type: 'REORDER',
        description: 'Reordered tasks',
        payload: { activeId, overId },
      });
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">React Taskboard</p>
          <h1>To-Do List</h1>
          <p className="hero-copy">
            Plan the day, reshuffle the chaos, and keep a visible trail of every move.
          </p>
        </div>
        <div className="shortcut-card">
          <span>Keyboard</span>
          <strong>Ctrl+Z</strong>
          <small>Undo. Add Shift to redo.</small>
        </div>
      </section>

      <section className="board-grid">
        <div className="panel task-panel">
          <TaskForm onAdd={addTask} />
          <FilterBar activeFilter={filter} counts={counts} onFilter={setActiveFilter} />
          <div className="task-list" data-testid="task-list">
            {visibleTasks.length === 0 ? (
              <p className="empty-state">No tasks in this view. A suspiciously peaceful place.</p>
            ) : (
              visibleTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  onDelete={deleteTask}
                  onDragStartTask={(id) => {
                    draggedTaskId.current = id;
                  }}
                  onDropTask={handleDropTask}
                  onEdit={editTask}
                  onToggle={toggleTask}
                  task={task}
                />
              ))
            )}
          </div>
        </div>
        <ActionLog actions={actions} />
      </section>
    </main>
  );
}

export default App;
