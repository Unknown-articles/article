import { useEffect, useRef, useState } from 'react';
import { isTaskLate } from '../utils/tasks';

export function TaskItem({ task, onDeleteTask, onEditTask, onReorderTasks, onToggleTask }) {
  const late = isTaskLate(task);
  const statusLabel = task.completed ? 'Mark incomplete' : 'Mark complete';
  const editInputRef = useRef(null);
  const deleteTimerRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [touchState, setTouchState] = useState({ active: false, startX: 0, startY: 0, deltaX: 0, deltaY: 0 });
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipingAway, setIsSwipingAway] = useState(false);

  useEffect(() => {
    setDraftTitle(task.title);
  }, [task.title]);

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [isEditing]);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
    };
  }, []);

  function startEditing() {
    setDraftTitle(task.title);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftTitle(task.title);
    setIsEditing(false);
  }

  function saveEdit() {
    const normalizedTitle = draftTitle.trim();
    if (!normalizedTitle) {
      cancelEditing();
      return;
    }

    if (normalizedTitle !== task.title) {
      onEditTask(task.id, normalizedTitle);
    }

    setIsEditing(false);
  }

  function handleInlineSubmit(event) {
    event.preventDefault();
    saveEdit();
  }

  function handleInlineKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditing();
    }
  }

  function handleDragStart(event) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/task-id', task.id);
  }

  function handleDrop(event) {
    event.preventDefault();
    const sourceTaskId = event.dataTransfer.getData('text/task-id');
    if (sourceTaskId) {
      onReorderTasks(sourceTaskId, task.id);
    }
  }

  function handleTouchStart(event) {
    if (isEditing || event.target.closest('button, input, form')) {
      return;
    }

    const touch = event.touches[0];
    setIsSwipingAway(false);
    setTouchState({
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
      deltaX: 0,
      deltaY: 0,
    });
  }

  function handleTouchMove(event) {
    if (!touchState.active) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - touchState.startX;
    const deltaY = touch.clientY - touchState.startY;

    setTouchState((currentState) => ({
      ...currentState,
      deltaX,
      deltaY,
    }));
    setSwipeOffset(deltaX);
  }

  function handleTouchEnd() {
    if (!touchState.active) {
      return;
    }

    const horizontalDistance = Math.abs(touchState.deltaX);
    const verticalDistance = Math.abs(touchState.deltaY);
    const isTap = horizontalDistance < 10 && verticalDistance < 10;
    const crossedDeleteThreshold = horizontalDistance > 100 && horizontalDistance > verticalDistance;

    if (crossedDeleteThreshold) {
      const finalOffset = touchState.deltaX < 0 ? -140 : 140;
      setIsSwipingAway(true);
      setSwipeOffset(finalOffset);
      deleteTimerRef.current = setTimeout(() => onDeleteTask(task.id), 220);
    } else {
      setSwipeOffset(0);
      if (isTap) {
        onToggleTask(task.id);
      }
    }

    setTouchState({ active: false, startX: 0, startY: 0, deltaX: 0, deltaY: 0 });
  }

  return (
    <article
      className={`task-card${task.completed ? ' is-completed' : ''}${late ? ' is-late' : ''}${isSwipingAway ? ' is-swiping-away' : ''}`}
      data-completed={task.completed ? 'true' : 'false'}
      data-late={late ? 'true' : 'false'}
      data-task-id={task.id}
      data-testid="task-item"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      style={{ transform: `translateX(${swipeOffset}px)` }}
    >
      <div className="task-card-main">
        <button
          aria-checked={task.completed ? 'true' : 'false'}
          aria-label={statusLabel}
          className={`checkbox-btn${task.completed ? ' checked' : ''}`}
          data-testid="task-checkbox"
          onClick={() => onToggleTask(task.id)}
          role="checkbox"
          type="button"
        >
          <span className="checkbox-mark" />
        </button>

        <div className="task-copy">
          {isEditing ? (
            <form className="inline-edit-form" onSubmit={handleInlineSubmit}>
              <input
                ref={editInputRef}
                className="text-input inline-edit-input"
                data-testid="inline-edit-input"
                onChange={(event) => setDraftTitle(event.target.value)}
                onKeyDown={handleInlineKeyDown}
                type="text"
                value={draftTitle}
              />
              <div className="inline-edit-actions">
                <button
                  className="primary-btn inline-btn"
                  data-testid="inline-edit-save"
                  type="submit"
                >
                  Save
                </button>
                <button
                  className="secondary-btn inline-btn"
                  data-testid="inline-edit-cancel"
                  onClick={cancelEditing}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <h2 className="task-title" data-testid="task-title">
              {task.title}
            </h2>
          )}
          <div className="task-meta">
            <span>Created {new Date(task.createdAt).toLocaleString()}</span>
            <span>{task.date ? `Due ${task.date}` : 'No due date'}</span>
            {late ? <span className="late-pill">Late</span> : null}
          </div>
        </div>
      </div>

      <div className="task-actions">
        <button className="ghost-btn" data-testid="task-edit-btn" onClick={startEditing} type="button">
          Edit
        </button>
        <button
          className="danger-btn"
          data-testid="task-delete-btn"
          onClick={() => onDeleteTask(task.id)}
          type="button"
        >
          Delete
        </button>
        <button
          className="drag-handle"
          data-testid="task-drag-handle"
          draggable
          onDragStart={handleDragStart}
          type="button"
        >
          Drag
        </button>
      </div>
    </article>
  );
}
