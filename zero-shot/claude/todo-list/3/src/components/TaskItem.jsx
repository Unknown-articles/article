import { useState, useRef } from 'react';
import InlineEdit from './InlineEdit';
import { isLate } from '../utils/task';

export default function TaskItem({
  task,
  onToggle,
  onEdit,
  onDelete,
  dragHandleProps,
  isDragging,
}) {
  const [editing, setEditing] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const deleteTriggered = useRef(false);

  const late = isLate(task);

  const handleSave = (title) => {
    onEdit(task.id, { title });
    setEditing(false);
  };

  const handleCancel = () => setEditing(false);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    deleteTriggered.current = false;
  };

  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 100 && !deleteTriggered.current) {
      deleteTriggered.current = true;
      setTimeout(() => onDelete(task.id), 0);
    }
  };

  const handleTouchEnd = () => {
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const cardClass = [
    'task-item',
    task.completed ? 'task-completed' : '',
    late ? 'task-late' : '',
    isDragging ? 'task-dragging' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      data-testid="task-item"
      data-task-id={task.id}
      data-completed={String(task.completed)}
      data-late={String(late)}
      className={cardClass}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <span
        data-testid="task-drag-handle"
        className="drag-handle"
        title="Drag to reorder"
        {...dragHandleProps}
      >
        ⠿
      </span>

      <input
        data-testid="task-checkbox"
        type="checkbox"
        checked={task.completed}
        aria-checked={String(task.completed)}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        onChange={() => onToggle(task.id)}
        className="task-checkbox"
      />

      <div className="task-content">
        {editing ? (
          <InlineEdit task={task} onSave={handleSave} onCancel={handleCancel} />
        ) : (
          <span data-testid="task-title" className="task-title">
            {task.title}
          </span>
        )}
        {task.date && !editing && (
          <span className={`task-date ${late ? 'task-date-late' : ''}`}>
            {task.date}
          </span>
        )}
      </div>

      {!editing && (
        <div className="task-actions">
          <button
            data-testid="task-edit-btn"
            type="button"
            onClick={() => setEditing(true)}
            className="btn btn-small"
            title="Edit"
          >
            ✏️
          </button>
          <button
            data-testid="task-delete-btn"
            type="button"
            onClick={() => onDelete(task.id)}
            className="btn btn-small btn-danger"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}
