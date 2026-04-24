import { Calendar, CirclePlus, GripVertical, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_ALIAS = "roadmap-items";
const TOUCH_GUARD_QUERY =
  "button, input, textarea, select, a, form, [data-touch-ignore='true']";
const TAP_DURATION_LIMIT = 200;
const TAP_MOVEMENT_LIMIT = 10;
const SWIPE_REMOVE_LIMIT = 100;
const SEGMENTS = {
  all: { label: "Overview", testId: "filter-all", countTestId: "filter-count-all" },
  pending: {
    label: "In Flight",
    testId: "filter-pending",
    countTestId: "filter-count-pending",
  },
  completed: {
    label: "Wrapped",
    testId: "filter-completed",
    countTestId: "filter-count-completed",
  },
  late: { label: "Late", testId: "filter-late", countTestId: "filter-count-late" },
};

function makeTodoEntry(summary, dueDate) {
  return {
    id: crypto.randomUUID(),
    title: summary,
    completed: false,
    date: dueDate,
    createdAt: new Date().toISOString(),
  };
}

function isOverdue(entry) {
  if (!entry.date || entry.completed) {
    return false;
  }

  const currentDay = new Date();
  currentDay.setHours(0, 0, 0, 0);

  return new Date(`${entry.date}T00:00:00`) < currentDay;
}

function readSavedEntries() {
  try {
    const rawData = localStorage.getItem(STORAGE_ALIAS);
    if (!rawData) {
      return [];
    }

    const parsedData = JSON.parse(rawData);
    return Array.isArray(parsedData) ? parsedData : [];
  } catch {
    return [];
  }
}

function classifyEntry(entry) {
  const overdue = isOverdue(entry);

  return {
    all: true,
    pending: !entry.completed && !overdue,
    completed: entry.completed,
    late: overdue,
  };
}

function formatTimelineEvent(type, description, payload) {
  return {
    type,
    description,
    timestamp: new Date().toISOString(),
    payload,
  };
}

export default function App() {
  const [headlineDraft, setHeadlineDraft] = useState("");
  const [deadlineDraft, setDeadlineDraft] = useState("");
  const [entries, setEntries] = useState(readSavedEntries);
  const [activeSegment, setActiveSegment] = useState("all");
  const [openEditorId, setOpenEditorId] = useState(null);
  const [editorDraft, setEditorDraft] = useState("");
  const [timeline, setTimeline] = useState([]);
  const [undoLedger, setUndoLedger] = useState([]);
  const [redoLedger, setRedoLedger] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const composerRef = useRef(null);
  const editorRef = useRef(null);
  const gestureRef = useRef(null);

  const totalEntries = entries.length;
  const segmentCounts = useMemo(
    () =>
      entries.reduce(
        (bucket, entry) => {
          const flags = classifyEntry(entry);
          return {
            all: bucket.all + 1,
            pending: bucket.pending + (flags.pending ? 1 : 0),
            completed: bucket.completed + (flags.completed ? 1 : 0),
            late: bucket.late + (flags.late ? 1 : 0),
          };
        },
        { all: 0, pending: 0, completed: 0, late: 0 },
      ),
    [entries],
  );
  const renderedEntries = useMemo(
    () => entries.filter((entry) => classifyEntry(entry)[activeSegment]),
    [activeSegment, entries],
  );

  useEffect(() => {
    composerRef.current?.focus();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_ALIAS, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    if (openEditorId) {
      editorRef.current?.focus();
      editorRef.current?.select();
    }
  }, [openEditorId]);

  useEffect(() => {
    function handleUndoKeyboard(event) {
      if (!event.ctrlKey || event.key.toLowerCase() !== "z") {
        return;
      }

      if (event.shiftKey) {
        if (redoLedger.length === 0) {
          return;
        }

        event.preventDefault();
        redoEntryChange();
        return;
      }

      if (undoLedger.length === 0) {
        return;
      }

      event.preventDefault();
      undoEntryChange();
    }

    window.addEventListener("keydown", handleUndoKeyboard);
    return () => window.removeEventListener("keydown", handleUndoKeyboard);
  }, [redoLedger, undoLedger]);

  function pushTimeline(type, description, payload) {
    setTimeline((currentTimeline) => [
      formatTimelineEvent(type, description, payload),
      ...currentTimeline,
    ]);
  }

  function applyEntryMutation(description, deriveNextEntries) {
    setUndoLedger((currentLedger) => [
      ...currentLedger,
      { tasks: entries, description },
    ]);
    setRedoLedger([]);
    setEntries(deriveNextEntries);
  }

  function undoEntryChange() {
    const snapshot = undoLedger.at(-1);
    if (!snapshot) {
      return;
    }

    setUndoLedger((currentLedger) => currentLedger.slice(0, -1));
    setRedoLedger((currentLedger) => [
      ...currentLedger,
      { tasks: entries, description: snapshot.description },
    ]);
    setEntries(snapshot.tasks);
    closeEditor();
    pushTimeline("UNDO", `Undo: ${snapshot.description}`, null);
  }

  function redoEntryChange() {
    const snapshot = redoLedger.at(-1);
    if (!snapshot) {
      return;
    }

    setRedoLedger((currentLedger) => currentLedger.slice(0, -1));
    setUndoLedger((currentLedger) => [
      ...currentLedger,
      { tasks: entries, description: snapshot.description },
    ]);
    setEntries(snapshot.tasks);
    closeEditor();
    pushTimeline("REDO", `Redo: ${snapshot.description}`, null);
  }

  function handleCreateEntry(event) {
    event.preventDefault();

    const trimmedHeadline = headlineDraft.trim();
    if (!trimmedHeadline) {
      composerRef.current?.focus();
      return;
    }

    const nextEntry = makeTodoEntry(trimmedHeadline, deadlineDraft);
    const description = `Added card: ${nextEntry.title}`;
    applyEntryMutation(description, (currentEntries) => [nextEntry, ...currentEntries]);
    pushTimeline("ADD_TASK", description, nextEntry);
    setHeadlineDraft("");
    setDeadlineDraft("");
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }

  function toggleEntry(id) {
    const currentEntry = entries.find((entry) => entry.id === id);
    if (!currentEntry) {
      return;
    }

    const description = `Updated card: ${currentEntry.title}`;
    const nextCompleted = !currentEntry.completed;
    pushTimeline("TOGGLE_TASK", description, { id, completed: nextCompleted });
    applyEntryMutation(description, (currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === id ? { ...entry, completed: nextCompleted } : entry,
      ),
    );
  }

  function deleteEntry(id) {
    const currentEntry = entries.find((entry) => entry.id === id);
    if (!currentEntry) {
      return;
    }

    const description = `Removed card: ${currentEntry.title}`;
    pushTimeline("DELETE_TASK", description, {
      id: currentEntry.id,
      title: currentEntry.title,
    });
    applyEntryMutation(description, (currentEntries) =>
      currentEntries.filter((entry) => entry.id !== id),
    );

    if (openEditorId === id) {
      closeEditor();
    }
  }

  function openEditor(entry) {
    setOpenEditorId(entry.id);
    setEditorDraft(entry.title);
  }

  function closeEditor() {
    setOpenEditorId(null);
    setEditorDraft("");
  }

  function saveEditor() {
    const trimmedEditorDraft = editorDraft.trim();
    if (!trimmedEditorDraft || !openEditorId) {
      return;
    }

    const currentEntry = entries.find((entry) => entry.id === openEditorId);
    if (!currentEntry) {
      closeEditor();
      return;
    }

    const description = `Renamed card: ${currentEntry.title} to ${trimmedEditorDraft}`;
    pushTimeline("EDIT_TASK", description, {
      id: currentEntry.id,
      oldTitle: currentEntry.title,
      newTitle: trimmedEditorDraft,
    });
    applyEntryMutation(description, (currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === openEditorId ? { ...entry, title: trimmedEditorDraft } : entry,
      ),
    );
    closeEditor();
  }

  function handleEditorSubmit(event) {
    event.preventDefault();
    saveEditor();
  }

  function handleEditorKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeEditor();
    }
  }

  function reorderRenderedEntries(startIndex, endIndex) {
    if (startIndex === endIndex) {
      return;
    }

    const orderedEntries = [...renderedEntries];
    const [liftedEntry] = orderedEntries.splice(startIndex, 1);
    orderedEntries.splice(endIndex, 0, liftedEntry);

    let visibleIndex = 0;
    const description = "Reordered cards";
    pushTimeline("REORDER", description, { fromIndex: startIndex, toIndex: endIndex });
    applyEntryMutation(description, (currentEntries) =>
      currentEntries.map((entry) => {
        if (!classifyEntry(entry)[activeSegment]) {
          return entry;
        }

        const nextVisibleEntry = orderedEntries[visibleIndex];
        visibleIndex += 1;
        return nextVisibleEntry;
      }),
    );
    closeEditor();
  }

  function beginDrag(event, id) {
    setDraggingId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  }

  function keepDropAlive(event) {
    if (draggingId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  }

  function handleDrop(event, targetId) {
    event.preventDefault();

    const sourceId = draggingId || event.dataTransfer.getData("text/plain") || null;
    setDraggingId(null);

    if (!sourceId || sourceId === targetId) {
      return;
    }

    const startIndex = renderedEntries.findIndex((entry) => entry.id === sourceId);
    const endIndex = renderedEntries.findIndex((entry) => entry.id === targetId);
    if (startIndex < 0 || endIndex < 0) {
      return;
    }

    reorderRenderedEntries(startIndex, endIndex);
  }

  function shouldBlockTouch(target) {
    return Boolean(target.closest(TOUCH_GUARD_QUERY));
  }

  function queueDeleteFromSwipe(entryId) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.swipeTriggered) {
      return;
    }

    gesture.swipeTriggered = true;
    window.setTimeout(() => deleteEntry(entryId), 0);
  }

  function handleTouchStart(event, id) {
    const touchPoint = event.touches[0];
    if (!touchPoint || shouldBlockTouch(event.target)) {
      gestureRef.current = null;
      return;
    }

    gestureRef.current = {
      taskId: id,
      startX: touchPoint.clientX,
      startY: touchPoint.clientY,
      startTime: Date.now(),
      isScroll: false,
      swipeTriggered: false,
    };
  }

  function handleTouchMove(event) {
    const gesture = gestureRef.current;
    const touchPoint = event.touches[0];
    if (!gesture || !touchPoint) {
      return;
    }

    const xDistance = touchPoint.clientX - gesture.startX;
    const yDistance = touchPoint.clientY - gesture.startY;
    const absoluteX = Math.abs(xDistance);
    const absoluteY = Math.abs(yDistance);

    if (absoluteY > absoluteX) {
      gesture.isScroll = true;
      return;
    }

    if (!gesture.isScroll && absoluteX > SWIPE_REMOVE_LIMIT) {
      queueDeleteFromSwipe(gesture.taskId);
    }
  }

  function handleTouchEnd(event, id) {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture || gesture.taskId !== id || gesture.isScroll) {
      return;
    }

    const touchPoint = event.changedTouches[0];
    if (!touchPoint || gesture.swipeTriggered) {
      return;
    }

    const xDistance = touchPoint.clientX - gesture.startX;
    const yDistance = touchPoint.clientY - gesture.startY;
    const absoluteX = Math.abs(xDistance);
    const absoluteY = Math.abs(yDistance);

    if (absoluteY > absoluteX) {
      return;
    }

    if (absoluteX > SWIPE_REMOVE_LIMIT) {
      queueDeleteFromSwipe(id);
      return;
    }

    const gestureDuration = Date.now() - gesture.startTime;
    if (
      absoluteX < TAP_MOVEMENT_LIMIT &&
      absoluteY < TAP_MOVEMENT_LIMIT &&
      gestureDuration < TAP_DURATION_LIMIT
    ) {
      toggleEntry(id);
    }
  }

  return (
    <main className="app-shell">
      <section className="todo-panel" aria-labelledby="app-title">
        <div className="panel-heading">
          <p className="eyebrow">Sprint board</p>
          <h1 id="app-title">Roadmap Pulse</h1>
          <div className="summary-strip" aria-label="Task summary">
            <span>{totalEntries} cards</span>
            <span>{segmentCounts.late} overdue</span>
          </div>
        </div>

        <form className="task-form" data-testid="task-form" onSubmit={handleCreateEntry}>
          <label className="field">
            <span>Card title</span>
            <input
              ref={composerRef}
              data-testid="task-input"
              value={headlineDraft}
              onChange={(event) => setHeadlineDraft(event.target.value)}
              placeholder="Add roadmap card"
              aria-label="Task title"
            />
          </label>

          <label className="field date-field">
            <span>Ship date</span>
            <input
              data-testid="task-date-input"
              type="date"
              value={deadlineDraft}
              onChange={(event) => setDeadlineDraft(event.target.value)}
              aria-label="Due date"
            />
          </label>

          <button className="submit-button" data-testid="task-submit" type="submit">
            <CirclePlus size={20} aria-hidden="true" />
            Queue
          </button>
        </form>

        <div className="filter-bar" aria-label="Task filters">
          {Object.entries(SEGMENTS).map(([segmentId, segment]) => (
            <button
              className="filter-button"
              data-testid={segment.testId}
              type="button"
              aria-pressed={String(activeSegment === segmentId)}
              key={segmentId}
              onClick={() => {
                if (activeSegment !== segmentId) {
                  pushTimeline("SET_FILTER", `Set lane: ${segmentId}`, {
                    filter: segmentId,
                  });
                }
                setActiveSegment(segmentId);
                closeEditor();
              }}
            >
              <span>{segment.label}</span>
              <span className="filter-count" data-testid={segment.countTestId}>
                {segmentCounts[segmentId]}
              </span>
            </button>
          ))}
        </div>

        <div className="task-list" data-testid="task-list" aria-live="polite">
          {renderedEntries.map((entry) => {
            const overdue = isOverdue(entry);
            const editing = openEditorId === entry.id;

            return (
              <article
                className={`task-item${overdue ? " is-late" : ""}${
                  entry.completed ? " is-completed" : ""
                }`}
                data-testid="task-item"
                data-task-id={entry.id}
                data-completed={String(entry.completed)}
                data-late={String(overdue)}
                key={entry.id}
                onDragOver={keepDropAlive}
                onDrop={(event) => handleDrop(event, entry.id)}
                onTouchEnd={(event) => handleTouchEnd(event, entry.id)}
                onTouchMove={handleTouchMove}
                onTouchStart={(event) => handleTouchStart(event, entry.id)}
              >
                <div className="task-content">
                  <button
                    className="drag-handle"
                    data-testid="task-drag-handle"
                    type="button"
                    draggable="true"
                    aria-label={`Drag ${entry.title}`}
                    onDragEnd={() => setDraggingId(null)}
                    onDragStart={(event) => beginDrag(event, entry.id)}
                  >
                    <GripVertical size={18} aria-hidden="true" />
                  </button>

                  <button
                    className="task-checkbox"
                    data-testid="task-checkbox"
                    type="button"
                    role="checkbox"
                    aria-checked={String(entry.completed)}
                    aria-label={entry.completed ? "Mark incomplete" : "Mark complete"}
                    onClick={() => toggleEntry(entry.id)}
                  >
                    <span aria-hidden="true" />
                  </button>

                  <div>
                    {editing ? (
                      <form className="inline-edit-form" onSubmit={handleEditorSubmit}>
                        <input
                          ref={editorRef}
                          data-testid="inline-edit-input"
                          value={editorDraft}
                          onChange={(event) => setEditorDraft(event.target.value)}
                          onKeyDown={handleEditorKeydown}
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
                          onClick={closeEditor}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <h2 data-testid="task-title">{entry.title}</h2>
                    )}
                    <p>
                      <Calendar size={16} aria-hidden="true" />
                      {entry.date ? `Ships ${entry.date}` : "No ship date"}
                    </p>
                  </div>
                </div>

                <div className="task-actions">
                  <span className="status-pill">
                    {entry.completed ? "Closed" : overdue ? "At risk" : "Active"}
                  </span>
                  {!editing && (
                    <button
                      className="edit-button"
                      data-testid="task-edit-btn"
                      type="button"
                      aria-label={`Edit ${entry.title}`}
                      onClick={() => openEditor(entry)}
                    >
                      <Pencil size={18} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    className="delete-button"
                    data-testid="task-delete-btn"
                    type="button"
                    aria-label={`Delete ${entry.title}`}
                    onClick={() => deleteEntry(entry.id)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <section className="action-log" data-testid="action-log" aria-label="Action log">
          <h2>Timeline</h2>
          <div className="log-list">
            {timeline.map((eventItem) => (
              <article
                className="log-entry"
                data-testid="log-entry"
                key={`${eventItem.timestamp}-${eventItem.type}-${eventItem.description}`}
              >
                <div>
                  <span className="log-type" data-testid="log-type">
                    {eventItem.type}
                  </span>
                  <p>{eventItem.description}</p>
                </div>
                <time className="log-timestamp" data-testid="log-timestamp">
                  {eventItem.timestamp}
                </time>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
