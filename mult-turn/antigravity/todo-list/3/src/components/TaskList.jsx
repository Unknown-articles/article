import React, { useState } from 'react';

export default function TaskList({ todos, toggleTodo, removeTodo, renameTodo }) {
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [touchStates, setTouchStates] = useState({});

  const isOverdue = (task) => {
    if (!task.date || task.completed) return false;
    
    // Get local date in YYYY-MM-DD
    const today = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const localToday = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    
    // Date string comparative works naturally for YYYY-MM-DD format
    return task.date < localToday;
  };

  const handleEditClick = (task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
  };

  const handleSaveEdit = (id) => {
    if (!editTitle.trim()) return;
    renameTodo(id, editTitle.trim());
    setEditingTaskId(null);
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
  };

  const handleKeyDown = (e, id) => {
    if (e.key === 'Enter') handleSaveEdit(id);
    if (e.key === 'Escape') handleCancelEdit();
  };

  const handleTouchStart = (e, taskId) => {
    const target = e.target;
    if (target.closest('.task-checkbox-container, .task-delete-btn')) return;
    
    const touch = e.touches[0];
    setTouchStates(prev => ({
      ...prev,
      [taskId]: {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: performance.now(),
        currentX: touch.clientX,
        currentY: touch.clientY,
        isSwiping: false,
        isTapping: true,
        target: target
      }
    }));
  };

  const handleTouchMove = (e, taskId) => {
    const touchState = touchStates[taskId];
    if (!touchState) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchState.startX);
    const deltaY = Math.abs(touch.clientY - touchState.startY);
    
    let isSwiping = touchState.isSwiping;
    let isTapping = touchState.isTapping;
    
    if (deltaY > deltaX) {
      // Vertical scroll, allow default but stop gesture
      isSwiping = false;
      isTapping = false;
    } else if (deltaX > 10) {
      // Horizontal swipe
      isSwiping = true;
      isTapping = false;
      e.preventDefault(); // Prevent scroll
    }
    
    setTouchStates(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        currentX: touch.clientX,
        currentY: touch.clientY,
        isSwiping,
        isTapping
      }
    }));
  };

  const handleTouchEnd = (e, taskId) => {
    const touchState = touchStates[taskId];
    if (!touchState) return;
    
    // eslint-disable-next-line react-hooks/purity
    const deltaTime = performance.now() - touchState.startTime;
    const deltaX = touchState.currentX - touchState.startX;
    const deltaY = Math.abs(touchState.currentY - touchState.startY);
    
    if (touchState.isSwiping && Math.abs(deltaX) > 100 && deltaY < Math.abs(deltaX)) {
      // Swipe to delete
      setTimeout(() => removeTodo(taskId), 300);
    } else if (touchState.isTapping && Math.abs(deltaX) < 10 && deltaY < 10 && deltaTime < 200 && touchState.target.closest('.task-content')) {
      // Tap to complete
      toggleTodo(taskId);
    }
    
    setTouchStates(prev => {
      const newState = { ...prev };
      delete newState[taskId];
      return newState;
    });
  };


  return (
    <div className="task-list glass-panel" data-testid="task-list">
      {todos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <p>No todos yet. Add one above!</p>
        </div>
      ) : (
        todos.map((task) => {
          const late = isOverdue(task);
          
          return (
            <div 
              key={task.id} 
              className={`task-item ${task.completed ? 'completed' : ''} ${late ? 'late' : ''}`}
              data-testid="task-item"
              data-task-id={task.id}
              data-completed={task.completed ? "true" : "false"}
              data-late={late ? "true" : "false"}
              onTouchStart={(e) => handleTouchStart(e, task.id)}
              onTouchMove={(e) => handleTouchMove(e, task.id)}
              onTouchEnd={(e) => handleTouchEnd(e, task.id)}
            >
              <button 
                type="button"
                className="task-checkbox-container"
                onClick={() => toggleTodo(task.id)}
                data-testid="task-checkbox"
                aria-checked={task.completed ? "true" : "false"}
                aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                style={{ background: 'none', border: 'none', padding: 0, outline: 'none' }}
              >
                <div className="task-checkbox-custom">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </button>
              <div className="task-content">
                {editingTaskId === task.id ? (
                  <div className="inline-edit-container" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <input 
                      type="text"
                      className="input-field"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '1rem', flex: 1, minWidth: 0 }}
                      data-testid="inline-edit-input"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, task.id)}
                      autoFocus
                    />
                    <button 
                      type="button"
                      className="submit-btn"
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem', borderRadius: '0.5rem' }}
                      data-testid="inline-edit-save"
                      onClick={() => handleSaveEdit(task.id)}
                    >
                      Save
                    </button>
                    <button 
                      type="button"
                      className="task-delete-btn"
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem', background: 'rgba(255,255,255,0.1)', flex: 'none' }}
                      data-testid="inline-edit-cancel"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <span className="task-title" data-testid="task-title">
                    {task.title}
                  </span>
                )}
                {(task.date || task.createdAt) && (
                  <div className="task-meta">
                    {task.date && (
                      <span className="task-date">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        {task.date} {late && ' (Late)'}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button 
                type="button"
                className="task-delete-btn"
                data-testid="task-drag-handle"
                aria-label="Drag to reorder"
                style={{ cursor: 'grab' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="12" r="1"></circle>
                  <circle cx="9" cy="5" r="1"></circle>
                  <circle cx="9" cy="19" r="1"></circle>
                  <circle cx="15" cy="12" r="1"></circle>
                  <circle cx="15" cy="5" r="1"></circle>
                  <circle cx="15" cy="19" r="1"></circle>
                </svg>
              </button>
              {editingTaskId !== task.id && (
                <button 
                  type="button"
                  className="task-delete-btn"
                  data-testid="task-edit-btn"
                  onClick={() => handleEditClick(task)}
                  aria-label="Edit task"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                </button>
              )}
              <button 
                type="button"
                className="task-delete-btn"
                data-testid="task-delete-btn"
                onClick={() => removeTodo(task.id)}
                aria-label="Delete task"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
