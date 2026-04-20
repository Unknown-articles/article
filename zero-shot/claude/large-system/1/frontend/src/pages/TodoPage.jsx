import React, { useState, useRef } from 'react';
import { useTodo } from '../context/TodoContext.jsx';
import TaskItem from '../components/TaskItem.jsx';
import ActionLog from '../components/ActionLog.jsx';

const FILTERS = ['all', 'completed', 'pending', 'late'];

export default function TodoPage() {
  const { tasks, addTask, reorderTasks, undo, redo, isLate } = useTodo();
  const [filter, setFilter] = useState('all');
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [showLog, setShowLog] = useState(false);
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);

  const filtered = tasks.filter(t => {
    if (filter === 'completed') return t.completed;
    if (filter === 'pending') return !t.completed;
    if (filter === 'late') return isLate(t);
    return true;
  });

  const handleAdd = e => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addTask(newTitle.trim(), newDate);
    setNewTitle('');
    setNewDate('');
  };

  const handleDragStart = i => { dragIdx.current = i; };
  const handleDragOver = i => { dragOverIdx.current = i; };
  const handleDrop = () => {
    if (dragIdx.current === null || dragOverIdx.current === null) return;
    const newOrder = [...tasks];
    const [moved] = newOrder.splice(dragIdx.current, 1);
    newOrder.splice(dragOverIdx.current, 0, moved);
    reorderTasks(newOrder);
    dragIdx.current = null;
    dragOverIdx.current = null;
  };

  return (
    <main className="page">
      <div className="todo-header">
        <h1>Shared Task List</h1>
        <div className="todo-actions">
          <button onClick={undo} className="btn btn-sm" title="Ctrl+Z">Undo</button>
          <button onClick={redo} className="btn btn-sm" title="Ctrl+Shift+Z">Redo</button>
          <button onClick={() => setShowLog(v => !v)} className="btn btn-sm">
            {showLog ? 'Hide Log' : 'Show Log'}
          </button>
        </div>
      </div>

      <form onSubmit={handleAdd} className="add-task-form">
        <input
          placeholder="New task title…"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
        />
        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
        <button type="submit" className="btn btn-primary">Add</button>
      </form>

      <div className="filter-bar">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >{f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      {filtered.length === 0
        ? <p className="empty">No tasks here.</p>
        : (
          <ul className="task-list">
            {filtered.map((task, i) => (
              <TaskItem
                key={task.id}
                task={task}
                index={i}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))}
          </ul>
        )}

      {showLog && <ActionLog />}
    </main>
  );
}
