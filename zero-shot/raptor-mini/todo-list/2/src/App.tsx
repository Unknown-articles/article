import { DragEvent, FormEvent, TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Task = {
  id: string;
  title: string;
  completed: boolean;
  date: string;
  createdAt: string;
};

type FilterMode = 'all' | 'completed' | 'pending' | 'late';

type ActionType =
  | 'ADD_TASK'
  | 'EDIT_TASK'
  | 'DELETE_TASK'
  | 'TOGGLE_TASK'
  | 'REORDER'
  | 'SET_FILTER'
  | 'UNDO'
  | 'REDO';

type LogEntry = {
  type: ActionType;
  description: string;
  timestamp: string;
  payload: Record<string, unknown> | null;
};

type History = {
  past: Task[][];
  present: Task[];
  future: Task[][];
};

const STORAGE_KEY = 'tasks';

const getInitialTasks = (): Task[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as Task[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (task): task is Task =>
        typeof task.id === 'string' &&
        typeof task.title === 'string' &&
        typeof task.completed === 'boolean' &&
        typeof task.date === 'string' &&
        typeof task.createdAt === 'string'
    );
  } catch {
    return [];
  }
};

const isLateTask = (task: Task) => {
  if (task.completed) return false;
  const dueDate = new Date(task.date);
  const now = new Date();
  return dueDate < now;
};

const formatDate = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const createLogEntry = (
  type: ActionType,
  description: string,
  payload: Record<string, unknown> | null = null
): LogEntry => ({
  type,
  description,
  timestamp: new Date().toISOString(),
  payload
});

const reorderList = (list: Task[], fromId: string, toId: string): Task[] => {
  const fromIndex = list.findIndex((item) => item.id === fromId);
  const toIndex = list.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

const App = () => {
  const [history, setHistory] = useState<History>({
    past: [],
    present: getInitialTasks(),
    future: []
  });
  const [filter, setFilter] = useState<FilterMode>('all');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const touchStateRef = useRef<
    Record<
      string,
      {
        startX: number;
        thresholdReached: boolean;
        timerId: number | null;
        moved: boolean;
      }
    >
  >({});

  const tasks = history.present;

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((current) => [entry, ...current]);
  }, []);

  const updateTasks = useCallback(
    (nextTasks: Task[], action: ActionType, description: string, payload: Record<string, unknown> | null = null) => {
      setHistory((current) => ({
        past: [...current.past, current.present],
        present: nextTasks,
        future: []
      }));
      addLog(createLogEntry(action, description, payload));
    },
    [addLog]
  );

  const undo = useCallback(() => {
    setHistory((current) => {
      if (current.past.length === 0) return current;
      const previous = current.past[current.past.length - 1];
      const nextPast = current.past.slice(0, -1);
      const nextFuture = [current.present, ...current.future];
      addLog(createLogEntry('UNDO', 'Undo last change', null));
      return { past: nextPast, present: previous, future: nextFuture };
    });
  }, [addLog]);

  const redo = useCallback(() => {
    setHistory((current) => {
      if (current.future.length === 0) return current;
      const next = current.future[0];
      const nextFuture = current.future.slice(1);
      const nextPast = [...current.past, current.present];
      addLog(createLogEntry('REDO', 'Redo last undone change', null));
      return { past: nextPast, present: next, future: nextFuture };
    });
  }, [addLog]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filter === 'all') return true;
      if (filter === 'completed') return task.completed;
      if (filter === 'pending') return !task.completed && !isLateTask(task);
      if (filter === 'late') return isLateTask(task);
      return true;
    });
  }, [tasks, filter]);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      completed: tasks.filter((task) => task.completed).length,
      pending: tasks.filter((task) => !task.completed && !isLateTask(task)).length,
      late: tasks.filter((task) => isLateTask(task)).length
    }),
    [tasks]
  );

  const handleFilter = (mode: FilterMode) => {
    setFilter(mode);
    addLog(createLogEntry('SET_FILTER', `Filter set to ${mode}`, { filter: mode }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: trimmedTitle,
      completed: false,
      date: date || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString()
    };

    updateTasks([...tasks, newTask], 'ADD_TASK', `Added task: ${trimmedTitle}`, {
      taskId: newTask.id,
      title: newTask.title,
      date: newTask.date
    });
    setTitle('');
    setDate('');
    titleInputRef.current?.focus();
  };

  const handleToggle = (taskId: string) => {
    const nextTasks = tasks.map((task) =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );
    updateTasks(nextTasks, 'TOGGLE_TASK', 'Toggled task completion', { taskId });
  };

  const handleDelete = (taskId: string) => {
    const nextTasks = tasks.filter((task) => task.id !== taskId);
    updateTasks(nextTasks, 'DELETE_TASK', 'Deleted task', { taskId });
    if (editingTaskId === taskId) {
      setEditingTaskId(null);
      setInlineTitle('');
    }
  };

  const beginInlineEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setInlineTitle(task.title);
  };

  const cancelInlineEdit = () => {
    setEditingTaskId(null);
    setInlineTitle('');
  };

  const saveInlineEdit = (taskId: string) => {
    const trimmedTitle = inlineTitle.trim();
    if (!trimmedTitle) return;
    const nextTasks = tasks.map((task) =>
      task.id === taskId ? { ...task, title: trimmedTitle } : task
    );
    updateTasks(nextTasks, 'EDIT_TASK', `Edited task: ${trimmedTitle}`, {
      taskId,
      title: trimmedTitle
    });
    setEditingTaskId(null);
    setInlineTitle('');
  };

  const handleDragStart = (taskId: string, event: DragEvent<HTMLLIElement>) => {
    event.dataTransfer?.setData('text/plain', taskId);
    event.dataTransfer?.setDragImage(event.currentTarget, 16, 16);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
  };

  const handleDrop = (taskId: string) => {
    if (!draggedTaskId || draggedTaskId === taskId) return;
    const nextTasks = reorderList(tasks, draggedTaskId, taskId);
    updateTasks(nextTasks, 'REORDER', 'Reordered tasks', {
      fromId: draggedTaskId,
      toId: taskId
    });
    setDraggedTaskId(null);
  };

  const handleTouchStart = (taskId: string, event: TouchEvent<HTMLLIElement>) => {
    const startX = event.touches[0]?.clientX ?? 0;
    touchStateRef.current[taskId] = {
      startX,
      thresholdReached: false,
      timerId: null,
      moved: false
    };
  };

  const handleTouchMove = (taskId: string, event: TouchEvent<HTMLLIElement>) => {
    const state = touchStateRef.current[taskId];
    if (!state) return;
    const currentX = event.touches[0]?.clientX ?? 0;
    const deltaX = currentX - state.startX;
    if (Math.abs(deltaX) > 10) {
      state.moved = true;
    }
    if (!state.thresholdReached && Math.abs(deltaX) > 100) {
      state.thresholdReached = true;
      state.timerId = window.setTimeout(() => {
        handleDelete(taskId);
      }, 300);
    }
  };

  const handleTouchEnd = (taskId: string, event: TouchEvent<HTMLLIElement>) => {
    const state = touchStateRef.current[taskId];
    if (!state) return;
    if (state.thresholdReached) {
      if (state.timerId) {
        window.clearTimeout(state.timerId);
      }
      handleDelete(taskId);
      delete touchStateRef.current[taskId];
      return;
    }

    const target = event.target as HTMLElement;
    if (state.moved === false && !target.closest('button, input')) {
      handleToggle(taskId);
    }
    delete touchStateRef.current[taskId];
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>To-Do List</h1>
          <p>Modern React task manager with undo/redo, drag-and-drop, and mobile gestures.</p>
        </div>
      </header>

      <main>
        <section className="panel panel-form">
          <form data-testid="task-form" className="task-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label htmlFor="task-title">Title</label>
              <input
                id="task-title"
                data-testid="task-input"
                ref={titleInputRef}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Add a new task"
                autoComplete="off"
              />
            </div>
            <div className="form-row">
              <label htmlFor="task-date">Due date</label>
              <input
                id="task-date"
                data-testid="task-date-input"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <button data-testid="task-submit" type="submit" className="primary-button">
              Add task
            </button>
          </form>
        </section>

        <section className="panel panel-filters">
          <div className="filter-group">
            {([
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Pending' },
              { id: 'completed', label: 'Completed' },
              { id: 'late', label: 'Late' }
            ] as const).map((item) => {
              const mode = item.id as FilterMode;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`filter-${item.id}`}
                  aria-pressed={filter === mode}
                  className={filter === mode ? 'filter-button active' : 'filter-button'}
                  onClick={() => handleFilter(mode)}
                >
                  <span>{item.label}</span>
                  <span data-testid={`filter-count-${item.id}`} className="filter-count">
                    {counts[item.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel panel-list">
          <h2>Tasks</h2>
          <ul data-testid="task-list" className="task-list">
            {filteredTasks.length === 0 ? (
              <li className="empty-state">No tasks available.</li>
            ) : (
              filteredTasks.map((task) => {
                const late = isLateTask(task);
                return (
                  <li
                    key={task.id}
                    data-testid="task-item"
                    data-task-id={task.id}
                    data-completed={task.completed ? 'true' : 'false'}
                    data-late={late ? 'true' : 'false'}
                    className={`task-card ${task.completed ? 'completed' : ''} ${late ? 'late' : ''}`}
                    draggable
                    onDragStart={(event) => handleDragStart(task.id, event)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(task.id)}
                    onTouchStart={(event) => handleTouchStart(task.id, event)}
                    onTouchMove={(event) => handleTouchMove(task.id, event)}
                    onTouchEnd={(event) => handleTouchEnd(task.id, event)}
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (!target.closest('button, input')) {
                        handleToggle(task.id);
                      }
                    }}
                  >
                    <div className="task-card-main">
                      <button
                        type="button"
                        className="drag-handle"
                        data-testid="task-drag-handle"
                        aria-label="Drag task"
                      >
                        ⋮⋮
                      </button>

                      <label className="task-checkbox-label">
                        <input
                          type="checkbox"
                          data-testid="task-checkbox"
                          checked={task.completed}
                          aria-checked={task.completed}
                          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                          onChange={() => handleToggle(task.id)}
                        />
                        <span className="checkbox-custom" />
                      </label>

                      <div className="task-content">
                        {editingTaskId === task.id ? (
                          <div className="inline-edit-form">
                            <input
                              data-testid="inline-edit-input"
                              value={inlineTitle}
                              onChange={(event) => setInlineTitle(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                  event.stopPropagation();
                                  cancelInlineEdit();
                                }
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  saveInlineEdit(task.id);
                                }
                              }}
                              autoFocus
                            />
                            <div className="inline-buttons">
                              <button
                                type="button"
                                data-testid="inline-edit-save"
                                className="primary-button"
                                onClick={() => saveInlineEdit(task.id)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                data-testid="inline-edit-cancel"
                                className="secondary-button"
                                onClick={cancelInlineEdit}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="task-title-row">
                            <p data-testid="task-title" className="task-title">
                              {task.title}
                            </p>
                            <div className="task-meta">
                              <span>{formatDate(task.date)}</span>
                              <span>{task.completed ? 'Completed' : late ? 'Late' : 'Pending'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {editingTaskId !== task.id ? (
                      <div className="task-actions">
                        <button
                          type="button"
                          data-testid="task-edit-btn"
                          className="secondary-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            beginInlineEdit(task);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          data-testid="task-delete-btn"
                          className="danger-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(task.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <section className="panel panel-log">
          <h2>Action Log</h2>
          <div data-testid="action-log" className="action-log">
            {logs.length === 0 ? (
              <div className="empty-state">No actions yet.</div>
            ) : (
              logs.map((entry, index) => (
                <div className="log-entry" key={`${entry.timestamp}-${index}`} data-testid="log-entry">
                  <span className="log-type" data-testid="log-type">{entry.type}</span>
                  <span className="log-description">{entry.description}</span>
                  <span className="log-timestamp" data-testid="log-timestamp">{entry.timestamp}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
