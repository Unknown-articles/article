import { useRef, useState } from 'react';

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`));
}

export function TaskItem({
  draggingTaskId,
  onDeleteTask,
  onDragEnd,
  onDragOverTask,
  onDragStart,
  onEditTask,
  onToggleTask,
  task,
}) {
  const touchStartXRef = useRef(0);
  const shouldTrackSwipeRef = useRef(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const resetSwipe = () => {
    setSwipeOffset(0);
    shouldTrackSwipeRef.current = false;
  };

  return (
    <div className="task-card-shell">
      <div className="swipe-delete-indicator">Release to delete</div>
      <article
        className={`task-card ${task.completed ? 'task-card-completed' : ''} ${
          task.isLate ? 'task-card-late' : ''
        } ${draggingTaskId === task.id ? 'task-card-dragging' : ''}`}
        draggable
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          event.preventDefault();
          onDragOverTask(task.id);
        }}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          onDragStart();
        }}
        onTouchEnd={() => {
          if (swipeOffset <= -120) {
            onDeleteTask(task.id);
            return;
          }

          resetSwipe();
        }}
        onTouchMove={(event) => {
          if (!shouldTrackSwipeRef.current) {
            return;
          }

          const nextOffset = event.touches[0].clientX - touchStartXRef.current;
          setSwipeOffset(Math.min(0, Math.max(nextOffset, -160)));
        }}
        onTouchStart={(event) => {
          if (event.target.closest('button')) {
            shouldTrackSwipeRef.current = false;
            return;
          }

          shouldTrackSwipeRef.current = true;
          touchStartXRef.current = event.touches[0].clientX;
        }}
        style={{
          transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
        }}
      >
        <button
          aria-label={`Mark ${task.title} as ${
            task.completed ? 'incomplete' : 'complete'
          }`}
          className={`status-toggle ${task.completed ? 'status-toggle-checked' : ''}`}
          onClick={() => onToggleTask(task.id)}
          type="button"
        >
          <span />
        </button>
        <button
          aria-label={`Toggle completion for ${task.title}`}
          className="task-copy"
          onClick={() => onToggleTask(task.id)}
          type="button"
        >
          <div className="task-copy-row">
            <h3>{task.title}</h3>
            <span className="task-badge">{task.completed ? 'Completed' : 'Active'}</span>
          </div>
          <p>
            Due <strong>{formatDate(task.date)}</strong>
            {task.isLate ? <span className="late-label"> Late</span> : null}
          </p>
        </button>
        <div className="task-actions">
          <span className="drag-hint">Drag</span>
          <button className="ghost-button" onClick={() => onEditTask(task.id)} type="button">
            Edit
          </button>
          <button
            className="ghost-button ghost-button-danger"
            onClick={() => onDeleteTask(task.id)}
            type="button"
          >
            Delete
          </button>
        </div>
      </article>
    </div>
  );
}
