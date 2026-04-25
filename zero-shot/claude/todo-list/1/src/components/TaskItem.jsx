import { useState, useRef } from 'react';
import InlineEditForm from './InlineEditForm.jsx';
import { isLate } from '../utils/taskUtils.js';

export default function TaskItem({
  task,
  dispatch,
  isDragOver,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const swipeTriggered = useRef(false);
  const late = isLate(task);

  /* ── Touch: swipe-to-delete & tap-to-complete ─────── */
  function handleTouchStart(e) {
    if (isEditing) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipeTriggered.current = false;
  }

  function handleTouchMove(e) {
    if (isEditing || touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;

    if (Math.abs(dx) > 100 && !swipeTriggered.current) {
      swipeTriggered.current = true;
      // Remove from state within 300ms of threshold being crossed
      setTimeout(() => {
        dispatch({ type: 'DELETE_TASK', id: task.id });
      }, 0);
    }
  }

  function handleTouchEnd(e) {
    if (isEditing || touchStartX.current === null) return;

    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;

    // Tap (small displacement) on non-interactive area → toggle complete
    if (!swipeTriggered.current && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const target = e.target;
      if (!target.closest('button') && !target.closest('input') && !target.closest('.drag-handle')) {
        dispatch({ type: 'TOGGLE_TASK', id: task.id });
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }

  /* ── Inline edit callbacks ────────────────────────── */
  function handleSave(updatedTask) {
    dispatch({ type: 'EDIT_TASK', task: updatedTask });
    setIsEditing(false);
  }

  function handleCancel() {
    setIsEditing(false);
  }

  /* ── Toggle / Delete ──────────────────────────────── */
  function handleToggle() {
    dispatch({ type: 'TOGGLE_TASK', id: task.id });
  }

  function handleDelete() {
    dispatch({ type: 'DELETE_TASK', id: task.id });
  }

  const ariaLabel = task.completed ? 'Mark incomplete' : 'Mark complete';

  return (
    <li
      data-testid="task-item"
      data-task-id={task.id}
      data-completed={String(task.completed)}
      data-late={String(late)}
      className={[
        'task-item',
        isDragOver ? 'drag-over' : '',
        isDragging ? 'is-dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Drag handle – only this element is draggable */}
      <span
        data-testid="task-drag-handle"
        className="drag-handle"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        aria-label="Drag to reorder"
        role="button"
        tabIndex={0}
      >
        ⠿
      </span>

      {/* Checkbox */}
      <input
        type="checkbox"
        data-testid="task-checkbox"
        className="task-checkbox"
        checked={task.completed}
        onChange={handleToggle}
        aria-checked={String(task.completed)}
        aria-label={ariaLabel}
      />

      {/* Title or inline edit form — inside the same card node */}
      {isEditing ? (
        <InlineEditForm task={task} onSave={handleSave} onCancel={handleCancel} />
      ) : (
        <>
          <span data-testid="task-title" className="task-title">
            {task.title}
          </span>
          {task.date && (
            <span className={`task-meta ${late ? 'late-label' : ''}`}>
              {late ? '⚠ ' : ''}{task.date}
            </span>
          )}
          <div className="task-actions">
            <button
              data-testid="task-edit-btn"
              className="btn-icon"
              onClick={() => setIsEditing(true)}
              aria-label="Edit task"
            >
              ✏️
            </button>
            <button
              data-testid="task-delete-btn"
              className="btn-icon delete"
              onClick={handleDelete}
              aria-label="Delete task"
            >
              🗑️
            </button>
          </div>
        </>
      )}
    </li>
  );
}
