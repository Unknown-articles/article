import { useState, useRef, useEffect } from 'react';
import { useTodo, EDIT_TASK, DELETE_TASK, TOGGLE_TASK } from '../TodoContext';
import { Check, Edit2, Trash2, GripVertical, X } from 'lucide-react';

export default function TaskItem({ task, index, onDragStart, onDragEnter, onDragEnd }) {
  const { dispatch } = useTodo();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartX = useRef(null);
  const swipeRef = useRef(null);
  const [isDeleted, setIsDeleted] = useState(false);

  const isLate = !task.completed && task.date && new Date(task.date) < new Date(new Date().setHours(0, 0, 0, 0));

  useEffect(() => {
    if (isEditing) {
      setEditTitle(task.title);
    }
  }, [isEditing, task.title]);

  const handleEditSave = () => {
    if (editTitle.trim() && editTitle.trim() !== task.title) {
      dispatch({ type: EDIT_TASK, payload: { id: task.id, title: editTitle.trim() } });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleEditSave();
    if (e.key === 'Escape') setIsEditing(false);
  };

  const handleDelete = () => {
    dispatch({ type: DELETE_TASK, payload: { id: task.id } });
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return;
    const diff = e.touches[0].clientX - touchStartX.current;
    if (diff < 0) { // Only swipe left to delete
      setSwipeOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset < -100) {
      // Trigger delete within 300ms
      setIsDeleted(true);
      setTimeout(() => {
        handleDelete();
      }, 300);
    } else {
      setSwipeOffset(0);
    }
    touchStartX.current = null;
  };

  if (isDeleted) return null;

  return (
    <div 
      className={`task-item ${task.completed ? 'completed' : ''} ${isLate ? 'late' : ''} swipe-container`}
      data-testid="task-item"
      data-task-id={task.id}
      data-completed={task.completed}
      data-late={isLate}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragEnter={(e) => onDragEnter(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className="swipe-background"
        style={{ opacity: Math.min(1, Math.abs(swipeOffset) / 100) }}
      >
        <Trash2 size={24} />
      </div>

      <div 
        className="swipe-content"
        style={{ 
          transform: `translateX(${swipeOffset}px)`,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          background: 'var(--bg-secondary)'
        }}
      >
        <div className="drag-handle" data-testid="task-drag-handle">
          <GripVertical size={20} />
        </div>

        <button 
          className={`task-checkbox ${task.completed ? 'checked' : ''}`}
          onClick={() => dispatch({ type: TOGGLE_TASK, payload: { id: task.id } })}
          data-testid="task-checkbox"
          aria-checked={task.completed}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {task.completed && <Check size={14} strokeWidth={3} />}
        </button>

        {isEditing ? (
          <div className="inline-edit-form">
            <input
              type="text"
              className="inline-edit-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              data-testid="inline-edit-input"
            />
            <button onClick={handleEditSave} className="icon-btn" data-testid="inline-edit-save">
              <Check size={18} />
            </button>
            <button onClick={() => setIsEditing(false)} className="icon-btn" data-testid="inline-edit-cancel">
              <X size={18} />
            </button>
          </div>
        ) : (
          <div className="task-content" onDoubleClick={() => setIsEditing(true)}>
            <div className="task-title" data-testid="task-title">
              {task.title}
            </div>
            <div className="task-meta">
              <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
              {task.date && <span>Due: {new Date(task.date).toLocaleDateString()}</span>}
              {isLate && <span className="late-text">LATE</span>}
            </div>
          </div>
        )}

        {!isEditing && (
          <div className="task-actions">
            <button onClick={() => setIsEditing(true)} className="icon-btn" data-testid="task-edit-btn">
              <Edit2 size={18} />
            </button>
            <button onClick={handleDelete} className="icon-btn delete" data-testid="task-delete-btn">
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
