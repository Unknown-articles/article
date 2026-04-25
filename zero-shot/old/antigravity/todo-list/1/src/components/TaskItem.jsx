import React, { useState } from 'react';
import { useTask } from '../context/TaskContext';

export default function TaskItem({ task }) {
  const { dispatch } = useTask();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDate, setEditDate] = useState(task.date || '');

  const isLate = () => {
    if (task.completed || !task.date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const [year, month, day] = task.date.split('-');
    const dueDate = new Date(year, month - 1, day);
    
    return dueDate < today;
  };

  const handleToggle = () => {
    dispatch({ type: 'TOGGLE_TASK', payload: task.id });
  };

  const handleDelete = () => {
    dispatch({ type: 'DELETE_TASK', payload: task.id });
  };

  const handleSave = () => {
    if (!editTitle.trim()) {
      handleDelete();
      return;
    }
    dispatch({
      type: 'UPDATE_TASK',
      payload: {
        id: task.id,
        updates: { title: editTitle.trim(), date: editDate || null }
      }
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="task-item editing animate-slide-in">
        <input 
          type="text" 
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          autoFocus 
        />
        <input 
          type="date" 
          value={editDate}
          onChange={e => setEditDate(e.target.value)}
        />
        <div className="actions">
          <button onClick={handleSave} className="success">Save</button>
          <button onClick={() => setIsEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`task-item ${task.completed ? 'completed' : ''} ${isLate() ? 'late' : ''} animate-slide-in`}>
      <div className="checkbox-wrapper" onClick={handleToggle}>
        <div className={`checkbox ${task.completed ? 'checked' : ''}`}>
          {task.completed && <span>✓</span>}
        </div>
      </div>
      <div className="task-content">
        <span className="task-title">{task.title}</span>
        {task.date && <span className="task-date">{task.date}</span>}
        {isLate() && <span className="badge badge-late">Late</span>}
      </div>
      <div className="actions">
        <button onClick={() => setIsEditing(true)}>Edit</button>
        <button onClick={handleDelete} className="danger">Delete</button>
      </div>
    </div>
  );
}
