import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'late', label: 'Late' }
];

const initialPresent = () => {
  const saved = localStorage.getItem('tasks');
  const parsed = saved ? JSON.parse(saved) : [];
  return {
    tasks: Array.isArray(parsed) ? parsed : [],
    filter: 'all'
  };
};

const initialState = {
  past: [],
  present: initialPresent(),
  future: []
};

const actionLogger = (type, description, payload = null) => ({
  type,
  description,
  timestamp: new Date().toISOString(),
  payload
});

const reducer = (state, action) => {
  const { past, present, future } = state;

  const withHistory = (nextPresent) => ({
    past: [...past, present],
    present: nextPresent,
    future: []
  });

  switch (action.type) {
    case 'ADD_TASK':
      return withHistory({
        ...present,
        tasks: [action.payload, ...present.tasks]
      });
    case 'EDIT_TASK':
      return withHistory({
        ...present,
        tasks: present.tasks.map((task) =>
          task.id === action.payload.id
            ? { ...task, title: action.payload.title, date: action.payload.date }
            : task
        )
      });
    case 'DELETE_TASK':
      return withHistory({
        ...present,
        tasks: present.tasks.filter((task) => task.id !== action.payload.id)
      });
    case 'TOGGLE_TASK':
      return withHistory({
        ...present,
        tasks: present.tasks.map((task) =>
          task.id === action.payload.id
            ? { ...task, completed: !task.completed }
            : task
        )
      });
    case 'REORDER': {
      const nextTasks = [...present.tasks];
      const [movedTask] = nextTasks.splice(action.payload.fromIndex, 1);
      nextTasks.splice(action.payload.toIndex, 0, movedTask);
      return withHistory({ ...present, tasks: nextTasks });
    }
    case 'SET_FILTER':
      return withHistory({ ...present, filter: action.payload.filter });
    case 'UNDO': {
      if (past.length === 0) return state;
      const previous = past[past.length - 1];
      return {
        past: past.slice(0, past.length - 1),
        present: previous,
        future: [present, ...future]
      };
    }
    case 'REDO': {
      if (future.length === 0) return state;
      const next = future[0];
      return {
        past: [...past, present],
        present: next,
        future: future.slice(1)
      };
    }
    default:
      return state;
  }
};

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isTaskLate = (task) => {
  if (task.completed || !task.date) return false;
  const due = new Date(task.date);
  due.setHours(23, 59, 59, 999);
  return due < new Date();
};

const getTaskCounts = (tasks) => ({
  all: tasks.length,
  completed: tasks.filter((task) => task.completed).length,
  pending: tasks.filter((task) => !task.completed && !isTaskLate(task)).length,
  late: tasks.filter((task) => isTaskLate(task)).length
});

const getFilteredTasks = (tasks, filter) => {
  switch (filter) {
    case 'completed':
      return tasks.filter((task) => task.completed);
    case 'pending':
      return tasks.filter((task) => !task.completed && !isTaskLate(task));
    case 'late':
      return tasks.filter((task) => isTaskLate(task));
    default:
      return tasks;
  }
};

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [actionLog, setActionLog] = useState([]);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDate, setEditingDate] = useState('');
  const [swipeOffsets, setSwipeOffsets] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [dragFromIndex, setDragFromIndex] = useState(null);
  const taskInputRef = useRef(null);
  const touchRefs = useRef({});
  const deleteTimeout = useRef(null);

  const { tasks, filter } = state.present;

  useEffect(() => {
    if (taskInputRef.current) taskInputRef.current.focus();
  }, []);

  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!event.ctrlKey || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) {
        dispatch({ type: 'REDO' });
        logAction('REDO', 'Redo last undone change');
      } else {
        dispatch({ type: 'UNDO' });
        logAction('UNDO', 'Undo last change');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const logAction = (type, description, payload = null) => {
    setActionLog((prev) => [actionLogger(type, description, payload), ...prev].slice(0, 100));
  };

  const triggerAction = (action, logType, description, payload = null) => {
    dispatch(action);
    logAction(logType, description, payload);
  };

  const addTask = (event) => {
    event.preventDefault();
    if (!formTitle.trim()) return;
    const task = {
      id: createId(),
      title: formTitle.trim(),
      completed: false,
      date: formDate || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };
    triggerAction({ type: 'ADD_TASK', payload: task }, 'ADD_TASK', `Added task: ${task.title}`, { task });
    setFormTitle('');
    setFormDate('');
    if (taskInputRef.current) taskInputRef.current.focus();
  };

  const saveEdit = (taskId) => {
    const title = editingTitle.trim();
    if (!title) return;
    triggerAction(
      { type: 'EDIT_TASK', payload: { id: taskId, title, date: editingDate || new Date().toISOString().split('T')[0] } },
      'EDIT_TASK',
      `Edited task: ${title}`,
      { id: taskId, title, date: editingDate }
    );
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const startEditing = (task) => {
    setEditingId(task.id);
    setEditingTitle(task.title);
    setEditingDate(task.date);
  };

  const removeTask = (taskId) => {
    triggerAction({ type: 'DELETE_TASK', payload: { id: taskId } }, 'DELETE_TASK', `Deleted task`, { id: taskId });
  };

  const toggleComplete = (taskId) => {
    triggerAction({ type: 'TOGGLE_TASK', payload: { id: taskId } }, 'TOGGLE_TASK', `Toggled task completion`, { id: taskId });
  };

  const reorderTasks = (fromIndex, toIndex) => {
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
    triggerAction({ type: 'REORDER', payload: { fromIndex, toIndex } }, 'REORDER', 'Reordered tasks', { fromIndex, toIndex });
  };

  const updateFilter = (nextFilter) => {
    triggerAction({ type: 'SET_FILTER', payload: { filter: nextFilter } }, 'SET_FILTER', `Set filter to ${nextFilter}`, { filter: nextFilter });
  };

  const filteredTasks = useMemo(() => getFilteredTasks(tasks, filter), [tasks, filter]);
  const counts = useMemo(() => getTaskCounts(tasks), [tasks]);

  const handleDragStart = (event, index) => {
    setDragFromIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleDrop = (event, index) => {
    event.preventDefault();
    const fromIndex = parseInt(event.dataTransfer.getData('text/plain'), 10);
    reorderTasks(fromIndex, index);
  };

  const handleTouchStart = (event, taskId) => {
    const { clientX, clientY } = event.touches[0] || {};
    touchRefs.current[taskId] = { startX: clientX, startY: clientY, moved: false, thresholdMet: false };
  };

  const handleTouchMove = (event, taskId) => {
    const touch = event.touches[0];
    if (!touch || !touchRefs.current[taskId]) return;
    const { startX, startY, thresholdMet } = touchRefs.current[taskId];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.abs(dx) > 10) {
      touchRefs.current[taskId].moved = true;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      event.preventDefault();
      setSwipeOffsets((prev) => ({ ...prev, [taskId]: dx }));
    }
    if (!thresholdMet && Math.abs(dx) > 100) {
      touchRefs.current[taskId].thresholdMet = true;
      setPendingDelete(taskId);
      deleteTimeout.current = setTimeout(() => {
        removeTask(taskId);
        setPendingDelete(null);
        setSwipeOffsets((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      }, 300);
    }
  };

  const handleTouchEnd = (event, taskId) => {
    const data = touchRefs.current[taskId];
    if (!data) return;
    if (!data.thresholdMet && !data.moved) {
      const target = event.target;
      if (!target.closest('button, input')) {
        toggleComplete(taskId);
      }
    }
    if (!data.thresholdMet && deleteTimeout.current) {
      clearTimeout(deleteTimeout.current);
      deleteTimeout.current = null;
    }
    if (!data.thresholdMet) {
      setPendingDelete(null);
      setSwipeOffsets((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
    delete touchRefs.current[taskId];
  };

  const handleInlineKeyDown = (event, taskId) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveEdit(taskId);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <h1>Todo List</h1>
          <p>Manage tasks, reorder them, swipe to delete, and undo/redo changes.</p>
        </div>
      </header>

      <section className="task-form-panel">
        <form data-testid="task-form" className="task-form" onSubmit={addTask}>
          <div className="field-group">
            <label htmlFor="taskTitle">Title</label>
            <input
              id="taskTitle"
              ref={taskInputRef}
              data-testid="task-input"
              value={formTitle}
              onChange={(event) => setFormTitle(event.target.value)}
              placeholder="Add a new task"
              required
            />
          </div>
          <div className="field-group">
            <label htmlFor="taskDate">Due date</label>
            <input
              id="taskDate"
              type="date"
              data-testid="task-date-input"
              value={formDate}
              onChange={(event) => setFormDate(event.target.value)}
            />
          </div>
          <button data-testid="task-submit" type="submit" className="primary-button">
            Add task
          </button>
        </form>
      </section>

      <section className="filter-bar">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            data-testid={`filter-${item.id}`}
            type="button"
            className={filter === item.id ? 'filter-button active' : 'filter-button'}
            onClick={() => updateFilter(item.id)}
            aria-pressed={filter === item.id}
          >
            <span>{item.label}</span>
            <span data-testid={`filter-count-${item.id}`} className="filter-count">
              {counts[item.id]}
            </span>
          </button>
        ))}
      </section>

      <section className="task-list-panel">
        <div data-testid="task-list" className="task-list">
          {filteredTasks.length === 0 ? (
            <div className="empty-state">No tasks match this filter.</div>
          ) : (
            filteredTasks.map((task, index) => {
              const isLate = isTaskLate(task);
              const isEditing = editingId === task.id;
              const transform = swipeOffsets[task.id] ? `translateX(${swipeOffsets[task.id]}px)` : 'none';
              const dragIndex = tasks.findIndex((item) => item.id === task.id);
              return (
                <article
                  key={task.id}
                  className={`task-card ${task.completed ? 'completed' : ''} ${isLate ? 'late' : ''}`}
                  data-testid="task-item"
                  data-task-id={task.id}
                  data-completed={task.completed}
                  data-late={isLate}
                  draggable={false}
                  style={{ transform }}
                  onTouchStart={(event) => handleTouchStart(event, task.id)}
                  onTouchMove={(event) => handleTouchMove(event, task.id)}
                  onTouchEnd={(event) => handleTouchEnd(event, task.id)}
                  onClick={(event) => {
                    if (event.target.closest('button, input, label')) return;
                    if (!isEditing) toggleComplete(task.id);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, dragIndex)}
                >
                  <div className="task-card-main">
                    <button
                      data-testid="task-checkbox"
                      type="button"
                      className={`task-checkbox ${task.completed ? 'checked' : ''}`}
                      aria-checked={task.completed}
                      aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                      onClick={() => toggleComplete(task.id)}
                    >
                      {task.completed ? '✓' : ''}
                    </button>
                    <div className="task-content">
                      {isEditing ? (
                        <form
                          className="inline-edit-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            saveEdit(task.id);
                          }}
                        >
                          <input
                            data-testid="inline-edit-input"
                            value={editingTitle}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            onKeyDown={(event) => handleInlineKeyDown(event, task.id)}
                            className="inline-edit-input"
                          />
                          <div className="inline-edit-actions">
                            <button data-testid="inline-edit-save" type="submit" className="primary-button small">
                              Save
                            </button>
                            <button
                              data-testid="inline-edit-cancel"
                              type="button"
                              className="secondary-button small"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="task-main-text">
                          <div data-testid="task-title" className="task-title">
                            {task.title}
                          </div>
                          <div className="task-meta">
                            <span>Due {task.date}</span>
                            <span>Created {new Date(task.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="task-actions">
                      <button
                        data-testid="task-edit-btn"
                        type="button"
                        className="icon-button"
                        onClick={() => startEditing(task)}
                      >
                        Edit
                      </button>
                      <button
                        data-testid="task-delete-btn"
                        type="button"
                        className="icon-button delete"
                        onClick={() => removeTask(task.id)}
                      >
                        Delete
                      </button>
                      <span
                        data-testid="task-drag-handle"
                        className="drag-handle"
                        draggable
                        onDragStart={(event) => handleDragStart(event, dragIndex)}
                        aria-label="Drag to reorder"
                      >
                        ☰
                      </span>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="action-log-panel">
        <h2>Action Log</h2>
        <div data-testid="action-log" className="action-log">
          {actionLog.length === 0 ? (
            <div className="empty-state">No actions yet.</div>
          ) : (
            actionLog.map((entry, index) => (
              <div key={`${entry.type}-${entry.timestamp}-${index}`} data-testid="log-entry" className="log-entry">
                <div className="log-header">
                  <span data-testid="log-type" className="log-type">
                    {entry.type}
                  </span>
                  <span data-testid="log-timestamp" className="log-timestamp">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="log-description">{entry.description}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
