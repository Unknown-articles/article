import { Calendar, CirclePlus, GripVertical, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const BOARD_STORAGE_ID = "task-board";
const TOUCH_SAFE_SELECTOR =
  "button, input, textarea, select, a, form, [data-touch-ignore='true']";
const QUICK_TAP_LIMIT_MS = 220;
const QUICK_TAP_DISTANCE_PX = 10;
const REMOVE_SWIPE_TRIGGER_PX = 100;
const VIEW_MODES = {
  all: { label: "Tudo", testId: "filter-all", countTestId: "filter-count-all" },
  pending: {
    label: "Ativas",
    testId: "filter-pending",
    countTestId: "filter-count-pending",
  },
  completed: {
    label: "Feitas",
    testId: "filter-completed",
    countTestId: "filter-count-completed",
  },
  late: { label: "Atrasadas", testId: "filter-late", countTestId: "filter-count-late" },
};

function buildEntry(label, dueOn) {
  return {
    id: crypto.randomUUID(),
    title: label,
    completed: false,
    date: dueOn,
    createdAt: new Date().toISOString(),
  };
}

function hasExpired(item) {
  if (!item.date || item.completed) {
    return false;
  }

  const midnightNow = new Date();
  midnightNow.setHours(0, 0, 0, 0);

  const deadline = new Date(`${item.date}T00:00:00`);
  return deadline < midnightNow;
}

function recoverBoard() {
  try {
    const rawBoard = localStorage.getItem(BOARD_STORAGE_ID);
    if (!rawBoard) {
      return [];
    }

    const decodedBoard = JSON.parse(rawBoard);
    return Array.isArray(decodedBoard) ? decodedBoard : [];
  } catch {
    return [];
  }
}

function matchView(item) {
  const overdue = hasExpired(item);

  return {
    all: true,
    pending: !item.completed && !overdue,
    completed: item.completed,
    late: overdue,
  };
}

function stampHistoryEntry(kind, detail, data) {
  return {
    type: kind,
    description: detail,
    timestamp: new Date().toISOString(),
    payload: data,
  };
}

export default function App() {
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDeadline, setDraftDeadline] = useState("");
  const [boardItems, setBoardItems] = useState(recoverBoard);
  const [selectedView, setSelectedView] = useState("all");
  const [editingCardId, setEditingCardId] = useState(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [historyFeed, setHistoryFeed] = useState([]);
  const [undoTrail, setUndoTrail] = useState([]);
  const [redoTrail, setRedoTrail] = useState([]);
  const [movingCardId, setMovingCardId] = useState(null);
  const createInputRef = useRef(null);
  const renameInputRef = useRef(null);
  const touchStateRef = useRef(null);

  const totalCards = boardItems.length;
  const countersByView = useMemo(
    () =>
      boardItems.reduce(
        (totals, item) => {
          const viewFlags = matchView(item);

          return {
            all: totals.all + 1,
            pending: totals.pending + (viewFlags.pending ? 1 : 0),
            completed: totals.completed + (viewFlags.completed ? 1 : 0),
            late: totals.late + (viewFlags.late ? 1 : 0),
          };
        },
        { all: 0, pending: 0, completed: 0, late: 0 },
      ),
    [boardItems],
  );
  const cardsOnScreen = useMemo(
    () => boardItems.filter((item) => matchView(item)[selectedView]),
    [boardItems, selectedView],
  );

  useEffect(() => {
    createInputRef.current?.focus();
  }, []);

  useEffect(() => {
    localStorage.setItem(BOARD_STORAGE_ID, JSON.stringify(boardItems));
  }, [boardItems]);

  useEffect(() => {
    if (editingCardId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingCardId]);

  useEffect(() => {
    function monitorUndoShortcuts(event) {
      if (!event.ctrlKey || event.key.toLowerCase() !== "z") {
        return;
      }

      if (event.shiftKey) {
        if (redoTrail.length === 0) {
          return;
        }

        event.preventDefault();
        restoreForward();
        return;
      }

      if (undoTrail.length === 0) {
        return;
      }

      event.preventDefault();
      restoreBackward();
    }

    window.addEventListener("keydown", monitorUndoShortcuts);
    return () => window.removeEventListener("keydown", monitorUndoShortcuts);
  }, [redoTrail, undoTrail]);

  function pushHistory(kind, detail, data) {
    setHistoryFeed((currentFeed) => [
      stampHistoryEntry(kind, detail, data),
      ...currentFeed,
    ]);
  }

  function commitBoardChange(detail, recipe) {
    setUndoTrail((currentTrail) => [...currentTrail, { tasks: boardItems, description: detail }]);
    setRedoTrail([]);
    setBoardItems(recipe);
  }

  function restoreBackward() {
    const lastAction = undoTrail.at(-1);
    if (!lastAction) {
      return;
    }

    setUndoTrail((currentTrail) => currentTrail.slice(0, -1));
    setRedoTrail((currentTrail) => [
      ...currentTrail,
      { tasks: boardItems, description: lastAction.description },
    ]);
    setBoardItems(lastAction.tasks);
    abortRename();
    pushHistory("UNDO", `Desfez: ${lastAction.description}`, null);
  }

  function restoreForward() {
    const nextAction = redoTrail.at(-1);
    if (!nextAction) {
      return;
    }

    setRedoTrail((currentTrail) => currentTrail.slice(0, -1));
    setUndoTrail((currentTrail) => [
      ...currentTrail,
      { tasks: boardItems, description: nextAction.description },
    ]);
    setBoardItems(nextAction.tasks);
    abortRename();
    pushHistory("REDO", `Refez: ${nextAction.description}`, null);
  }

  function handleCreate(event) {
    event.preventDefault();

    const cleanLabel = draftLabel.trim();
    if (!cleanLabel) {
      createInputRef.current?.focus();
      return;
    }

    const freshEntry = buildEntry(cleanLabel, draftDeadline);
    const detail = `Nova tarefa: ${freshEntry.title}`;
    commitBoardChange(detail, (currentBoard) => [freshEntry, ...currentBoard]);
    pushHistory("ADD_TASK", detail, freshEntry);
    setDraftLabel("");
    setDraftDeadline("");
    window.requestAnimationFrame(() => createInputRef.current?.focus());
  }

  function flipCard(cardId) {
    const currentCard = boardItems.find((item) => item.id === cardId);
    if (!currentCard) {
      return;
    }

    const newState = !currentCard.completed;
    const detail = `Alternou tarefa: ${currentCard.title}`;
    pushHistory("TOGGLE_TASK", detail, { id: cardId, completed: newState });
    commitBoardChange(detail, (currentBoard) =>
      currentBoard.map((item) =>
        item.id === cardId ? { ...item, completed: newState } : item,
      ),
    );
  }

  function removeCard(cardId) {
    const currentCard = boardItems.find((item) => item.id === cardId);
    if (!currentCard) {
      return;
    }

    const detail = `Removeu tarefa: ${currentCard.title}`;
    pushHistory("DELETE_TASK", detail, {
      id: currentCard.id,
      title: currentCard.title,
    });
    commitBoardChange(detail, (currentBoard) =>
      currentBoard.filter((item) => item.id !== cardId),
    );

    if (editingCardId === cardId) {
      abortRename();
    }
  }

  function beginRename(item) {
    setEditingCardId(item.id);
    setEditingDraft(item.title);
  }

  function abortRename() {
    setEditingCardId(null);
    setEditingDraft("");
  }

  function confirmRename() {
    const cleanDraft = editingDraft.trim();
    if (!cleanDraft || !editingCardId) {
      return;
    }

    const currentCard = boardItems.find((item) => item.id === editingCardId);
    if (!currentCard) {
      abortRename();
      return;
    }

    const detail = `Renomeou tarefa: ${currentCard.title} para ${cleanDraft}`;
    pushHistory("EDIT_TASK", detail, {
      id: currentCard.id,
      oldTitle: currentCard.title,
      newTitle: cleanDraft,
    });
    commitBoardChange(detail, (currentBoard) =>
      currentBoard.map((item) =>
        item.id === editingCardId ? { ...item, title: cleanDraft } : item,
      ),
    );
    abortRename();
  }

  function handleRenameSubmit(event) {
    event.preventDefault();
    confirmRename();
  }

  function handleRenameKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      abortRename();
    }
  }

  function moveVisibleCards(originIndex, destinationIndex) {
    if (originIndex === destinationIndex) {
      return;
    }

    const reorderedCards = [...cardsOnScreen];
    const [draggedCard] = reorderedCards.splice(originIndex, 1);
    reorderedCards.splice(destinationIndex, 0, draggedCard);

    let visibleCursor = 0;
    const detail = "Reordenou tarefas";
    pushHistory("REORDER", detail, { fromIndex: originIndex, toIndex: destinationIndex });
    commitBoardChange(detail, (currentBoard) =>
      currentBoard.map((item) => {
        if (!matchView(item)[selectedView]) {
          return item;
        }

        const nextVisibleItem = reorderedCards[visibleCursor];
        visibleCursor += 1;
        return nextVisibleItem;
      }),
    );
    abortRename();
  }

  function startDrag(event, cardId) {
    setMovingCardId(cardId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", cardId);
  }

  function allowDrop(event) {
    if (movingCardId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  }

  function finishDrop(event, targetId) {
    event.preventDefault();

    const sourceId = movingCardId || event.dataTransfer.getData("text/plain") || null;
    setMovingCardId(null);

    if (!sourceId || sourceId === targetId) {
      return;
    }

    const originIndex = cardsOnScreen.findIndex((item) => item.id === sourceId);
    const destinationIndex = cardsOnScreen.findIndex((item) => item.id === targetId);
    if (originIndex < 0 || destinationIndex < 0) {
      return;
    }

    moveVisibleCards(originIndex, destinationIndex);
  }

  function ignoreTouch(targetNode) {
    return Boolean(targetNode.closest(TOUCH_SAFE_SELECTOR));
  }

  function queueSwipeRemoval(cardId) {
    const gestureState = touchStateRef.current;
    if (!gestureState || gestureState.swipeTriggered) {
      return;
    }

    gestureState.swipeTriggered = true;
    window.setTimeout(() => removeCard(cardId), 0);
  }

  function handleCardTouchStart(event, cardId) {
    const touchPoint = event.touches[0];
    if (!touchPoint || ignoreTouch(event.target)) {
      touchStateRef.current = null;
      return;
    }

    touchStateRef.current = {
      taskId: cardId,
      startX: touchPoint.clientX,
      startY: touchPoint.clientY,
      startTime: Date.now(),
      isScroll: false,
      swipeTriggered: false,
    };
  }

  function handleCardTouchMove(event) {
    const gestureState = touchStateRef.current;
    const touchPoint = event.touches[0];
    if (!gestureState || !touchPoint) {
      return;
    }

    const deltaX = touchPoint.clientX - gestureState.startX;
    const deltaY = touchPoint.clientY - gestureState.startY;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    if (verticalDistance > horizontalDistance) {
      gestureState.isScroll = true;
      return;
    }

    if (!gestureState.isScroll && horizontalDistance > REMOVE_SWIPE_TRIGGER_PX) {
      queueSwipeRemoval(gestureState.taskId);
    }
  }

  function handleCardTouchEnd(event, cardId) {
    const gestureState = touchStateRef.current;
    touchStateRef.current = null;
    if (!gestureState || gestureState.taskId !== cardId || gestureState.isScroll) {
      return;
    }

    const touchPoint = event.changedTouches[0];
    if (!touchPoint || gestureState.swipeTriggered) {
      return;
    }

    const deltaX = touchPoint.clientX - gestureState.startX;
    const deltaY = touchPoint.clientY - gestureState.startY;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    if (verticalDistance > horizontalDistance) {
      return;
    }

    if (horizontalDistance > REMOVE_SWIPE_TRIGGER_PX) {
      queueSwipeRemoval(cardId);
      return;
    }

    const heldFor = Date.now() - gestureState.startTime;
    if (
      horizontalDistance < QUICK_TAP_DISTANCE_PX &&
      verticalDistance < QUICK_TAP_DISTANCE_PX &&
      heldFor < QUICK_TAP_LIMIT_MS
    ) {
      flipCard(cardId);
    }
  }

  return (
    <main className="app-shell">
      <section className="todo-panel" aria-labelledby="app-title">
        <div className="panel-heading">
          <p className="eyebrow">Studio Flow</p>
          <h1 id="app-title">Agenda de Entregas</h1>
          <div className="summary-strip" aria-label="Task summary">
            <span>{totalCards} itens</span>
            <span>{countersByView.late} vencendo</span>
          </div>
        </div>

        <form className="task-form" data-testid="task-form" onSubmit={handleCreate}>
          <label className="field">
            <span>Atividade</span>
            <input
              ref={createInputRef}
              data-testid="task-input"
              value={draftLabel}
              onChange={(event) => setDraftLabel(event.target.value)}
              placeholder="Registrar tarefa"
              aria-label="Task title"
            />
          </label>

          <label className="field date-field">
            <span>Prazo</span>
            <input
              data-testid="task-date-input"
              type="date"
              value={draftDeadline}
              onChange={(event) => setDraftDeadline(event.target.value)}
              aria-label="Due date"
            />
          </label>

          <button className="submit-button" data-testid="task-submit" type="submit">
            <CirclePlus size={20} aria-hidden="true" />
            Criar
          </button>
        </form>

        <div className="filter-bar" aria-label="Task filters">
          {Object.entries(VIEW_MODES).map(([viewId, view]) => (
            <button
              className="filter-button"
              data-testid={view.testId}
              type="button"
              aria-pressed={String(selectedView === viewId)}
              key={viewId}
              onClick={() => {
                if (selectedView !== viewId) {
                  pushHistory("SET_FILTER", `Mudou filtro: ${viewId}`, { filter: viewId });
                }
                setSelectedView(viewId);
                abortRename();
              }}
            >
              <span>{view.label}</span>
              <span className="filter-count" data-testid={view.countTestId}>
                {countersByView[viewId]}
              </span>
            </button>
          ))}
        </div>

        <div className="task-list" data-testid="task-list" aria-live="polite">
          {cardsOnScreen.map((item) => {
            const overdue = hasExpired(item);
            const isRenaming = editingCardId === item.id;

            return (
              <article
                className={`task-item${overdue ? " is-late" : ""}${
                  item.completed ? " is-completed" : ""
                }`}
                data-testid="task-item"
                data-task-id={item.id}
                data-completed={String(item.completed)}
                data-late={String(overdue)}
                key={item.id}
                onDragOver={allowDrop}
                onDrop={(event) => finishDrop(event, item.id)}
                onTouchEnd={(event) => handleCardTouchEnd(event, item.id)}
                onTouchMove={handleCardTouchMove}
                onTouchStart={(event) => handleCardTouchStart(event, item.id)}
              >
                <div className="task-content">
                  <button
                    className="drag-handle"
                    data-testid="task-drag-handle"
                    type="button"
                    draggable="true"
                    aria-label={`Drag ${item.title}`}
                    onDragEnd={() => setMovingCardId(null)}
                    onDragStart={(event) => startDrag(event, item.id)}
                  >
                    <GripVertical size={18} aria-hidden="true" />
                  </button>

                  <button
                    className="task-checkbox"
                    data-testid="task-checkbox"
                    type="button"
                    role="checkbox"
                    aria-checked={String(item.completed)}
                    aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
                    onClick={() => flipCard(item.id)}
                  >
                    <span aria-hidden="true" />
                  </button>

                  <div>
                    {isRenaming ? (
                      <form className="inline-edit-form" onSubmit={handleRenameSubmit}>
                        <input
                          ref={renameInputRef}
                          data-testid="inline-edit-input"
                          value={editingDraft}
                          onChange={(event) => setEditingDraft(event.target.value)}
                          onKeyDown={handleRenameKeydown}
                          aria-label="Edit task title"
                        />
                        <button
                          className="inline-save-button"
                          data-testid="inline-edit-save"
                          type="submit"
                        >
                          Salvar
                        </button>
                        <button
                          className="inline-cancel-button"
                          data-testid="inline-edit-cancel"
                          type="button"
                          onClick={abortRename}
                        >
                          Fechar
                        </button>
                      </form>
                    ) : (
                      <h2 data-testid="task-title">{item.title}</h2>
                    )}
                    <p>
                      <Calendar size={16} aria-hidden="true" />
                      {item.date ? `Entrega em ${item.date}` : "Sem data definida"}
                    </p>
                  </div>
                </div>

                <div className="task-actions">
                  <span className="status-pill">
                    {item.completed ? "Concluida" : overdue ? "Urgente" : "Em curso"}
                  </span>
                  {!isRenaming && (
                    <button
                      className="edit-button"
                      data-testid="task-edit-btn"
                      type="button"
                      aria-label={`Edit ${item.title}`}
                      onClick={() => beginRename(item)}
                    >
                      <Pencil size={18} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    className="delete-button"
                    data-testid="task-delete-btn"
                    type="button"
                    aria-label={`Delete ${item.title}`}
                    onClick={() => removeCard(item.id)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <section className="action-log" data-testid="action-log" aria-label="Action log">
          <h2>Historico</h2>
          <div className="log-list">
            {historyFeed.map((record) => (
              <article
                className="log-entry"
                data-testid="log-entry"
                key={`${record.timestamp}-${record.type}-${record.description}`}
              >
                <div>
                  <span className="log-type" data-testid="log-type">
                    {record.type}
                  </span>
                  <p>{record.description}</p>
                </div>
                <time className="log-timestamp" data-testid="log-timestamp">
                  {record.timestamp}
                </time>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
