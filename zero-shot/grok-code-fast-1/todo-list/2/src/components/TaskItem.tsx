import { useState, useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTodo } from '../TodoContext';
import { Task } from '../types';

interface TaskItemProps {
  task: Task;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, isEditing, onEdit, onCancelEdit }) => {
  const { dispatch } = useTodo();
  const [editTitle, setEditTitle] = useState(task.title);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const deleteTimeoutRef = useRef<number | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const now = new Date();
  const dueDate = new Date(task.date);
  const isLate = dueDate < now && !task.completed;

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const handleToggle = () => {
    dispatch({ type: 'TOGGLE_TASK', payload: task.id });
  };

  const handleDelete = () => {
    dispatch({ type: 'DELETE_TASK', payload: task.id });
  };

  const handleEditSubmit = () => {
    if (editTitle.trim() && editTitle !== task.title) {
      dispatch({ type: 'EDIT_TASK', payload: { id: task.id, title: editTitle.trim() } });
    }
    onCancelEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSubmit();
    } else if (e.key === 'Escape') {
      setEditTitle(task.title);
      onCancelEdit();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    // If horizontal movement exceeds 100px and is greater than vertical
    if (Math.abs(deltaX) > 100 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = setTimeout(() => {
        handleDelete();
      }, 300);
    }
  };

  const handleTouchEnd = () => {
    setTouchStartX(null);
    setTouchStartY(null);
    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
    }
  };

  const handleClick = () => {
    if (!isEditing) {
      handleToggle();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid="task-item"
      data-task-id={task.id}
      data-completed={task.completed}
      data-late={isLate}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      className={`flex items-center p-4 border rounded-md cursor-pointer ${
        task.completed ? 'bg-green-50 border-green-200' : isLate ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
      }`}
    >
      <button
        data-testid="task-drag-handle"
        {...attributes}
        {...listeners}
        className="mr-4 cursor-grab"
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        ⋮⋮
      </button>
      <input
        data-testid="task-checkbox"
        type="checkbox"
        checked={task.completed}
        onChange={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
        aria-checked={task.completed}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        className="mr-4"
      />
      {isEditing ? (
        <div className="flex-1 flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
          <input
            ref={editInputRef}
            data-testid="inline-edit-input"
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-2 py-1 border border-gray-300 rounded"
          />
          <button
            data-testid="inline-edit-save"
            onClick={handleEditSubmit}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save
          </button>
          <button
            data-testid="inline-edit-cancel"
            onClick={() => {
              setEditTitle(task.title);
              onCancelEdit();
            }}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <span
            data-testid="task-title"
            className={`flex-1 ${task.completed ? 'line-through text-gray-500' : ''}`}
          >
            {task.title}
          </span>
          <button
            data-testid="task-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="ml-4 px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Edit
          </button>
          <button
            data-testid="task-delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="ml-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
};

export default TaskItem;