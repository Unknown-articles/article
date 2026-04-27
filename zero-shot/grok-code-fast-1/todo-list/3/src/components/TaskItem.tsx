import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, Action } from '../types';
import { isLate } from '../utils';
import { InlineEditForm } from './InlineEditForm';

interface TaskItemProps {
  task: Task;
  dispatch: (action: Action) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, dispatch }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const deleteTimeout = useRef<number | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const handleEdit = () => setIsEditing(true);
  const handleDelete = () => dispatch({ type: 'DELETE_TASK', payload: task.id });
  const handleToggle = () => dispatch({ type: 'TOGGLE_TASK', payload: task.id });

  const handleSaveEdit = (title: string, date: string) => {
    dispatch({ type: 'EDIT_TASK', payload: { id: task.id, title, date } });
    setIsEditing(false);
  };

  const handleCancelEdit = () => setIsEditing(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current !== null) {
      const deltaX = e.touches[0].clientX - touchStartX.current;
      if (deltaX < 0) { // swipe left
        setSwipeOffset(Math.max(deltaX, -100));
      }
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset <= -100) {
      deleteTimeout.current = setTimeout(() => {
        handleDelete();
      }, 300);
    }
    setSwipeOffset(0);
    touchStartX.current = null;
  };

  const late = isLate(task);

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        data-testid="task-item"
        data-task-id={task.id}
        data-completed={task.completed.toString()}
        data-late={late.toString()}
        className="task-item editing"
      >
        <InlineEditForm
          initialTitle={task.title}
          initialDate={task.date}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, transform: `translateX(${swipeOffset}px)` }}
      data-testid="task-item"
      data-task-id={task.id}
      data-completed={task.completed.toString()}
      data-late={late.toString()}
      className={`task-item ${task.completed ? 'completed' : ''} ${late ? 'late' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleToggle} // tap to complete
    >
      <input
        data-testid="task-checkbox"
        type="checkbox"
        checked={task.completed}
        onChange={handleToggle}
        aria-checked={task.completed}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        onClick={(e) => e.stopPropagation()} // prevent toggle on click
      />
      <span data-testid="task-title" className="task-title">{task.title}</span>
      <span className="task-date">{new Date(task.date).toLocaleDateString()}</span>
      <button data-testid="task-edit-btn" onClick={(e) => { e.stopPropagation(); handleEdit(); }}>Edit</button>
      <button data-testid="task-delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(); }}>Delete</button>
      <div data-testid="task-drag-handle" {...attributes} {...listeners} className="drag-handle">⋮⋮</div>
    </div>
  );
};