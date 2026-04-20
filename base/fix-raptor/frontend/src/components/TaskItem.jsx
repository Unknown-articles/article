import React, { useState, useRef } from 'react';
import { useTodo } from '../context/TodoContext.jsx';

export default function TaskItem({ task, index, onDragStart, onDragOver, onDrop }) {
  const { toggleTask, deleteTask, updateTask, isLate } = useTodo();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDate, setEditDate] = useState(task.date ? task.date.split('T')[0] : '');

  // Touch / swipe state
  const touchStartX = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const late = isLate(task);

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
    setSwiping(true);
  }

  function handleTouchMove(e) {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    setSwipeOffset(Math.min(0, dx));
  }

  function handleTouchEnd() {
    if (swipeOffset < -80) deleteTask(task.id);
    else setSwipeOffset(0);
    setSwiping(false);
    touchStartX.current = null;
  }

  const saveEdit = () => {
    updateTask(task.id, { title: editTitle, date: editDate || null });
    setEditing(false);
  };

  return (
    <li
      className={`task-item ${task.completed ? 'completed' : ''} ${late ? 'late' : ''}`}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => { e.preventDefault(); onDragOver(index); }}
      onDrop={() => onDrop(index)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ transform: `translateX(${swipeOffset}px)`, transition: swiping ? 'none' : 'transform .2s' }}
    >
      {editing ? (
        <div className="task-edit">
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
          <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
          <button onClick={saveEdit} className="btn btn-sm btn-primary">Save</button>
          <button onClick={() => setEditing(false)} className="btn btn-sm">Cancel</button>
        </div>
      ) : (
        <>
          <input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} />
          <span className="task-title" onDoubleClick={() => setEditing(true)}>{task.title}</span>
          {task.date && <span className="task-date">{new Date(task.date).toLocaleDateString()}</span>}
          {late && <span className="badge badge-late">Late</span>}
          <div className="task-actions">
            <button onClick={() => setEditing(true)} className="btn btn-sm">Edit</button>
            <button onClick={() => deleteTask(task.id)} className="btn btn-sm btn-danger">Del</button>
          </div>
        </>
      )}
    </li>
  );
}
