import { useState } from 'react';

const TaskItem = ({ task, index, onEdit, onDelete, onToggle, onReorder }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDate, setEditDate] = useState(task.date.split('T')[0]);
  const [touchStart, setTouchStart] = useState(null);

  const isLate = !task.completed && new Date(task.date) < new Date();

  const handleEdit = () => {
    if (editTitle.trim()) {
      onEdit(task.id, editTitle.trim(), new Date(editDate));
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditTitle(task.title);
    setEditDate(task.date.split('T')[0]);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleEdit();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStart !== null) {
      const deltaX = e.changedTouches[0].clientX - touchStart;
      if (Math.abs(deltaX) < 10) {
        onToggle(task.id);
      } else if (deltaX < -100) {
        setTimeout(() => onDelete(task.id), 300);
      }
      setTouchStart(null);
    }
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', index);
  };

  return (
    <div
      data-testid="task-item"
      data-task-id={task.id}
      data-completed={task.completed.toString()}
      data-late={isLate.toString()}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {isEditing ? (
        <div data-testid="inline-edit-form">
          <input
            data-testid="inline-edit-input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <input
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
          />
          <button data-testid="inline-edit-save" onClick={handleEdit}>Save</button>
          <button data-testid="inline-edit-cancel" onClick={handleCancel}>Cancel</button>
        </div>
      ) : (
        <>
          <span data-testid="task-title">{task.title}</span>
          <input
            data-testid="task-checkbox"
            type="checkbox"
            checked={task.completed}
            onChange={() => onToggle(task.id)}
            aria-checked={task.completed}
            aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
          />
          <button data-testid="task-edit-btn" onClick={() => setIsEditing(true)}>Edit</button>
          <button data-testid="task-delete-btn" onClick={() => onDelete(task.id)}>Delete</button>
          <div data-testid="task-drag-handle" draggable onDragStart={handleDragStart}>⋮⋮</div>
        </>
      )}
    </div>
  );
};

export default TaskItem;