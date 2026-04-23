import { Calendar, CirclePlus, GripVertical, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const TASKS_STORAGE_KEY = "tasks";
const INTERACTIVE_TOUCH_SELECTOR =
  "button, input, textarea, select, a, form, [data-touch-ignore='true']";
const TAP_MAX_DURATION_MS = 200;
const TAP_MAX_DISPLACEMENT_PX = 10;
const SWIPE_DELETE_THRESHOLD_PX = 100;
const FILTERS = {
  all: {
    label: "All",
    testId: "filter-all",
    countTestId: "filter-count-all",
  },
  pending: {
    label: "Pending",
    testId: "filter-pending",
    countTestId: "filter-count-pending",
  },
  completed: {
    label: "Completed",
    testId: "filter-completed",
    countTestId: "filter-count-completed",
  },
  late: {
    label: "Late",
    testId: "filter-late",
    countTestId: "filter-count-late",
  },
};

function createTask(title, date) {
  return {
    id: crypto.randomUUID(),
    title,
    completed: false,
    date,
    createdAt: new Date().toISOString(),
  };
}

function isTaskLate(task) {
  if (!task.date || task.completed) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${task.date}T00:00:00`);
  return dueDate < today;
}

function loadStoredTasks() {
  try {
    const storedTasks = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!storedTasks) {
      return [];
    }

    const parsedTasks = JSON.parse(storedTasks);
    return Array.isArray(parsedTasks) ? parsedTasks : [];
  } catch {
    return [];
  }
}

function getTaskFilter(task) {
  const late = isTaskLate(task);

  return {
    all: true,
    pending: !task.completed && !late,
    completed: task.completed,
    late,
  };
}

function createLogEntry(type, description, payload) {
  return {
    type,
    description,
    timestamp: new Date().toISOString(),
    payload,
  };
}

export default function App() {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [tasks, setTasks] = useState(loadStoredTasks);
  const [activeFilter, setActiveFilter] = useState("all");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [actionLog, setActionLog] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const titleInputRef = useRef(null);
  const editInputRef = useRef(null);
  const touchGestureRef = useRef(null);

  const taskCount = tasks.length;
  const filterCounts = useMemo(
    () =>
      tasks.reduce(
        (counts, task) => {
          const taskFilter = getTaskFilter(task);

          return {
            all: counts.all + 1,
            pending: counts.pending + (taskFilter.pending ? 1 : 0),
            completed: counts.completed + (taskFilter.completed ? 1 : 0),
            late: counts.late + (taskFilter.late ? 1 : 0),
          };
        },
        { all: 0, pending: 0, completed: 0, late: 0 },
      ),
    [tasks],
  );
  const visibleTasks = useMemo(
    () => tasks.filter((task) => getTaskFilter(task)[activeFilter]),
    [activeFilter, tasks],
  );

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  useEffect(() => {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (editingTaskId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingTaskId]);

  useEffect(() => {
    function handleKeyboardUndoRedo(event) {
      if (!event.ctrlKey || event.key.toLowerCase() !== "z") {
        return;
      }

      if (event.shiftKey) {
        if (redoStack.length === 0) {
          return;
        }

        event.preventDefault();
        redoTaskChange();
        return;
      }

      if (undoStack.length === 0) {
        return;
      }

      event.preventDefault();
      undoTaskChange();
    }

    window.addEventListener("keydown", handleKeyboardUndoRedo);
    return () => window.removeEventListener("keydown", handleKeyboardUndoRedo);
  }, [redoStack, undoStack]);

  function handleSubmit(event) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      titleInputRef.current?.focus();
      return;
    }

    const newTask = createTask(trimmedTitle, date);
    const description = `Added task: ${newTask.title}`;
    applyUndoableTaskChange(description, (currentTasks) => [
      newTask,
      ...currentTasks,
    ]);
    addLogEntry("ADD_TASK", description, newTask);
    setTitle("");
    setDate("");
    window.requestAnimationFrame(() => titleInputRef.current?.focus());
  }

  function addLogEntry(type, description, payload) {
    setActionLog((currentLog) => [
      createLogEntry(type, description, payload),
      ...currentLog,
    ]);
  }

  function applyUndoableTaskChange(description, getNextTasks) {
    setUndoStack((currentUndoStack) => [
      ...currentUndoStack,
      { tasks, description },
    ]);
    setRedoStack([]);
    setTasks(getNextTasks);
  }

  function undoTaskChange() {
    const undoEntry = undoStack.at(-1);
    if (!undoEntry) {
      return;
    }

    setUndoStack((currentUndoStack) => currentUndoStack.slice(0, -1));
    setRedoStack((currentRedoStack) => [
      ...currentRedoStack,
      { tasks, description: undoEntry.description },
    ]);
    setTasks(undoEntry.tasks);
    cancelEditing();
    addLogEntry("UNDO", `Undo: ${undoEntry.description}`, null);
  }

  function redoTaskChange() {
    const redoEntry = redoStack.at(-1);
    if (!redoEntry) {
      return;
    }

    setRedoStack((currentRedoStack) => currentRedoStack.slice(0, -1));
    setUndoStack((currentUndoStack) => [
      ...currentUndoStack,
      { tasks, description: redoEntry.description },
    ]);
    setTasks(redoEntry.tasks);
    cancelEditing();
    addLogEntry("REDO", `Redo: ${redoEntry.description}`, null);
  }

  function toggleTask(taskId) {
    const taskToToggle = tasks.find((task) => task.id === taskId);
    if (!taskToToggle) {
      return;
    }

    const completed = !taskToToggle.completed;
    const description = `Toggled task: ${taskToToggle.title}`;
    addLogEntry("TOGGLE_TASK", description, {
      id: taskId,
      completed,
    });

    applyUndoableTaskChange(description, (currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, completed } : task,
      ),
    );
  }

  function deleteTask(taskId) {
    const taskToDelete = tasks.find((task) => task.id === taskId);
    if (!taskToDelete) {
      return;
    }

    const description = `Deleted task: ${taskToDelete.title}`;
    addLogEntry("DELETE_TASK", description, {
      id: taskToDelete.id,
      title: taskToDelete.title,
    });

    applyUndoableTaskChange(description, (currentTasks) =>
      currentTasks.filter((task) => task.id !== taskId),
    );
    if (editingTaskId === taskId) {
      cancelEditing();
    }
  }

  function startEditing(task) {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  }

  function cancelEditing() {
    setEditingTaskId(null);
    setEditingTitle("");
  }

  function saveEditing() {
    const trimmedTitle = editingTitle.trim();
    if (!trimmedTitle || !editingTaskId) {
      return;
    }

    const taskToEdit = tasks.find((task) => task.id === editingTaskId);
    if (!taskToEdit) {
      cancelEditing();
      return;
    }

    const description = `Edited task: ${taskToEdit.title} to ${trimmedTitle}`;
    addLogEntry("EDIT_TASK", description, {
      id: taskToEdit.id,
      oldTitle: taskToEdit.title,
      newTitle: trimmedTitle,
    });

    applyUndoableTaskChange(description, (currentTasks) =>
      currentTasks.map((task) =>
        task.id === editingTaskId ? { ...task, title: trimmedTitle } : task,
      ),
    );
    cancelEditing();
  }

  function handleInlineEditSubmit(event) {
    event.preventDefault();
    saveEditing();
  }

  function handleInlineEditKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  }

  function reorderVisibleTasks(fromIndex, toIndex) {
    if (fromIndex === toIndex) {
      return;
    }

    const reorderedVisibleTasks = [...visibleTasks];
    const [movedTask] = reorderedVisibleTasks.splice(fromIndex, 1);
    reorderedVisibleTasks.splice(toIndex, 0, movedTask);

    let nextVisibleIndex = 0;
    const description = "Reordered tasks";

    addLogEntry("REORDER", description, { fromIndex, toIndex });
    applyUndoableTaskChange(description, (currentTasks) =>
      currentTasks.map((task) => {
        if (!getTaskFilter(task)[activeFilter]) {
          return task;
        }

        const nextTask = reorderedVisibleTasks[nextVisibleIndex];
        nextVisibleIndex += 1;
        return nextTask;
      }),
    );
    cancelEditing();
  }

  function handleDragStart(event, taskId) {
    setDraggedTaskId(taskId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
  }

  function handleDragOver(event) {
    if (draggedTaskId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  }

  function handleDrop(event, targetTaskId) {
    event.preventDefault();

    const sourceTaskId =
      draggedTaskId || event.dataTransfer.getData("text/plain") || null;
    setDraggedTaskId(null);

    if (!sourceTaskId || sourceTaskId === targetTaskId) {
      return;
    }

    const fromIndex = visibleTasks.findIndex((task) => task.id === sourceTaskId);
    const toIndex = visibleTasks.findIndex((task) => task.id === targetTaskId);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    reorderVisibleTasks(fromIndex, toIndex);
  }

  function shouldIgnoreTouch(target) {
    return Boolean(target.closest(INTERACTIVE_TOUCH_SELECTOR));
  }

  function scheduleSwipeDelete(taskId) {
    const gesture = touchGestureRef.current;
    if (!gesture || gesture.swipeTriggered) {
      return;
    }

    gesture.swipeTriggered = true;
    window.setTimeout(() => deleteTask(taskId), 0);
  }

  function handleTaskTouchStart(event, taskId) {
    const touch = event.touches[0];
    if (!touch || shouldIgnoreTouch(event.target)) {
      touchGestureRef.current = null;
      return;
    }

    touchGestureRef.current = {
      taskId,
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isScroll: false,
      swipeTriggered: false,
    };
  }

  function handleTaskTouchMove(event) {
    const gesture = touchGestureRef.current;
    const touch = event.touches[0];
    if (!gesture || !touch) {
      return;
    }

    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absY > absX) {
      gesture.isScroll = true;
      return;
    }

    if (!gesture.isScroll && absX > SWIPE_DELETE_THRESHOLD_PX) {
      scheduleSwipeDelete(gesture.taskId);
    }
  }

  function handleTaskTouchEnd(event, taskId) {
    const gesture = touchGestureRef.current;
    touchGestureRef.current = null;
    if (!gesture || gesture.taskId !== taskId || gesture.isScroll) {
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch || gesture.swipeTriggered) {
      return;
    }

    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absY > absX) {
      return;
    }

    if (absX > SWIPE_DELETE_THRESHOLD_PX) {
      scheduleSwipeDelete(taskId);
      return;
    }

    const elapsed = Date.now() - gesture.startTime;
    if (
      absX < TAP_MAX_DISPLACEMENT_PX &&
      absY < TAP_MAX_DISPLACEMENT_PX &&
      elapsed < TAP_MAX_DURATION_MS
    ) {
      toggleTask(taskId);
    }
  }

  return (
    <main className="app-shell">
      <section className="todo-panel" aria-labelledby="app-title">
        <div className="panel-heading">
          <p className="eyebrow">Today</p>
          <h1 id="app-title">Task List</h1>
          <div className="summary-strip" aria-label="Task summary">
            <span>{taskCount} total</span>
            <span>{filterCounts.late} late</span>
          </div>
        </div>

        <form className="task-form" data-testid="task-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Task</span>
            <input
              ref={titleInputRef}
              data-testid="task-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Add a task"
              aria-label="Task title"
            />
          </label>

          <label className="field date-field">
            <span>Due date</span>
            <input
              data-testid="task-date-input"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-label="Due date"
            />
          </label>

          <button className="submit-button" data-testid="task-submit" type="submit">
            <CirclePlus size={20} aria-hidden="true" />
            Add
          </button>
        </form>

        <div className="filter-bar" aria-label="Task filters">
          {Object.entries(FILTERS).map(([filterId, filter]) => (
            <button
              className="filter-button"
              data-testid={filter.testId}
              type="button"
              aria-pressed={String(activeFilter === filterId)}
              key={filterId}
              onClick={() => {
                if (activeFilter !== filterId) {
                  addLogEntry("SET_FILTER", `Set filter: ${filterId}`, {
                    filter: filterId,
                  });
                }
                setActiveFilter(filterId);
                cancelEditing();
              }}
            >
              <span>{filter.label}</span>
              <span className="filter-count" data-testid={filter.countTestId}>
                {filterCounts[filterId]}
              </span>
            </button>
          ))}
        </div>

        <div className="task-list" data-testid="task-list" aria-live="polite">
          {visibleTasks.map((task) => {
            const late = isTaskLate(task);
            const isEditing = editingTaskId === task.id;

            return (
              <article
                className={`task-item${late ? " is-late" : ""}${
                  task.completed ? " is-completed" : ""
                }`}
                data-testid="task-item"
                data-task-id={task.id}
                data-completed={String(task.completed)}
                data-late={String(late)}
                key={task.id}
                onDragOver={handleDragOver}
                onDrop={(event) => handleDrop(event, task.id)}
                onTouchEnd={(event) => handleTaskTouchEnd(event, task.id)}
                onTouchMove={handleTaskTouchMove}
                onTouchStart={(event) => handleTaskTouchStart(event, task.id)}
              >
                <div className="task-content">
                  <button
                    className="drag-handle"
                    data-testid="task-drag-handle"
                    type="button"
                    draggable="true"
                    aria-label={`Drag ${task.title}`}
                    onDragEnd={() => setDraggedTaskId(null)}
                    onDragStart={(event) => handleDragStart(event, task.id)}
                  >
                    <GripVertical size={18} aria-hidden="true" />
                  </button>

                  <button
                    className="task-checkbox"
                    data-testid="task-checkbox"
                    type="button"
                    role="checkbox"
                    aria-checked={String(task.completed)}
                    aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                    onClick={() => toggleTask(task.id)}
                  >
                    <span aria-hidden="true" />
                  </button>

                  <div>
                    {isEditing ? (
                      <form
                        className="inline-edit-form"
                        onSubmit={handleInlineEditSubmit}
                      >
                        <input
                          ref={editInputRef}
                          data-testid="inline-edit-input"
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onKeyDown={handleInlineEditKeyDown}
                          aria-label="Edit task title"
                        />
                        <button
                          className="inline-save-button"
                          data-testid="inline-edit-save"
                          type="submit"
                        >
                          Save
                        </button>
                        <button
                          className="inline-cancel-button"
                          data-testid="inline-edit-cancel"
                          type="button"
                          onClick={cancelEditing}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <h2 data-testid="task-title">{task.title}</h2>
                    )}
                    <p>
                      <Calendar size={16} aria-hidden="true" />
                      {task.date ? `Due ${task.date}` : "No due date"}
                    </p>
                  </div>
                </div>

                <div className="task-actions">
                  <span className="status-pill">
                    {task.completed ? "Done" : late ? "Late" : "Open"}
                  </span>
                  {!isEditing && (
                    <button
                      className="edit-button"
                      data-testid="task-edit-btn"
                      type="button"
                      aria-label={`Edit ${task.title}`}
                      onClick={() => startEditing(task)}
                    >
                      <Pencil size={18} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    className="delete-button"
                    data-testid="task-delete-btn"
                    type="button"
                    aria-label={`Delete ${task.title}`}
                    onClick={() => deleteTask(task.id)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <section className="action-log" data-testid="action-log" aria-label="Action log">
          <h2>Action log</h2>
          <div className="log-list">
            {actionLog.map((entry) => (
              <article
                className="log-entry"
                data-testid="log-entry"
                key={`${entry.timestamp}-${entry.type}-${entry.description}`}
              >
                <div>
                  <span className="log-type" data-testid="log-type">
                    {entry.type}
                  </span>
                  <p>{entry.description}</p>
                </div>
                <time className="log-timestamp" data-testid="log-timestamp">
                  {entry.timestamp}
                </time>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
