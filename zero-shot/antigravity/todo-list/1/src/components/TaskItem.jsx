import React, { useState, useRef, useEffect, useContext } from 'react';
import { TodoContext } from '../App';
import { isTaskLate } from '../utils';
import { Edit2, Trash2, GripVertical, Check, X } from 'lucide-react';
import clsx from 'clsx';

export default function TaskItem({ task, index, onDragStart, onDragOver, onDrop }) {
  const { dispatch } = useContext(TodoContext);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const inputRef = useRef(null);
  
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchCurrentX, setTouchCurrentX] = useState(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const itemRef = useRef(null);

  const isLate = isTaskLate(task);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const toggleComplete = (e) => {
    e.stopPropagation();
    dispatch({
      type: 'TOGGLE_TASK',
      payload: { id: task.id },
      description: `Toggled task "${task.title}" to ${!task.completed ? 'completed' : 'incomplete'}`
    });
  };

  const startEdit = (e) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditTitle(task.title);
  };

  const saveEdit = () => {
    if (editTitle.trim() && editTitle !== task.title) {
      dispatch({
        type: 'EDIT_TASK',
        payload: { id: task.id, title: editTitle.trim() },
        description: `Edited task "${task.title}" to "${editTitle.trim()}"`
      });
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditTitle(task.title);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const handleDelete = (e) => {
    if (e) e.stopPropagation();
    dispatch({
      type: 'DELETE_TASK',
      payload: { id: task.id },
      description: `Deleted task: "${task.title}"`
    });
  };

  // Touch handlers for swipe to delete and tap to complete
  const handleTouchStart = (e) => {
    if (isEditing) return;
    // Don't intercept touches on buttons
    if (e.target.closest('button')) return;
    setTouchStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping || touchStartX === null) return;
    const currentX = e.touches[0].clientX;
    const diffX = currentX - touchStartX;
    // Only allow swipe left
    if (diffX < 0) {
      setTouchCurrentX(currentX);
      if (itemRef.current) {
        itemRef.current.style.transform = `translateX(${diffX}px)`;
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (!isSwiping || touchStartX === null) return;
    
    // Tap to complete
    if (touchCurrentX === null || Math.abs(touchCurrentX - touchStartX) < 10) {
      // It's a tap, but let's make sure it's not on a button
      if (!e.target.closest('button')) {
        toggleComplete(e);
      }
    } else {
      // It's a swipe
      const diffX = touchCurrentX - touchStartX;
      if (diffX < -100) {
        // Trigger delete
        setIsDeleting(true);
        if (itemRef.current) {
          itemRef.current.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
          itemRef.current.style.transform = 'translateX(-100%)';
          itemRef.current.style.opacity = '0';
        }
        setTimeout(() => {
          handleDelete();
        }, 300);
      } else {
        // Snap back
        if (itemRef.current) {
          itemRef.current.style.transition = 'transform 0.3s ease';
          itemRef.current.style.transform = 'translateX(0)';
          setTimeout(() => {
            if (itemRef.current) itemRef.current.style.transition = '';
          }, 300);
        }
      }
    }
    setTouchStartX(null);
    setTouchCurrentX(null);
    setIsSwiping(false);
  };

  if (isDeleting) {
    return <div ref={itemRef} className="task-item" style={{ visibility: 'hidden', padding: 0, height: 0, margin: 0, border: 'none' }} />;
  }

  return (
    <div
      ref={itemRef}
      className={clsx('task-item', isLate && 'late')}
      data-testid="task-item"
      data-task-id={task.id}
      data-completed={String(task.completed)}
      data-late={String(isLate)}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="drag-handle"
        data-testid="task-drag-handle"
        onPointerDown={(e) => e.target.parentElement.setAttribute('draggable', true)}
      >
        <GripVertical size={20} />
      </div>

      <div className="checkbox-wrapper">
        <button
          className="task-checkbox"
          data-testid="task-checkbox"
          aria-checked={task.completed}
          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
          onClick={toggleComplete}
        >
          <Check size={14} />
        </button>
      </div>

      <div className="task-content">
        {isEditing ? (
          <div className="inline-edit-form">
            <input
              ref={inputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              data-testid="inline-edit-input"
              className="inline-edit-input"
            />
            <button
              onClick={saveEdit}
              className="inline-btn save"
              data-testid="inline-edit-save"
            >
              Save
            </button>
            <button
              onClick={cancelEdit}
              className="inline-btn cancel"
              data-testid="inline-edit-cancel"
            >
              Cancel
            </button>
          </div>
        ) : (
          <span className="task-title" data-testid="task-title">
            {task.title}
          </span>
        )}
        <div className="task-meta">
          {task.date && (
            <span className={clsx(isLate && !task.completed && 'task-late-badge')}>
              {isLate && !task.completed ? 'Late: ' : 'Due: '} {task.date}
            </span>
          )}
        </div>
      </div>

      {!isEditing && (
        <div className="task-actions">
          <button className="action-btn" data-testid="task-edit-btn" onClick={startEdit}>
            <Edit2 size={18} />
          </button>
          <button className="action-btn delete" data-testid="task-delete-btn" onClick={handleDelete}>
            <Trash2 size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
