import { useState, useRef, useEffect } from 'react';
import { generateId } from '../utils/taskUtils.js';

export default function TaskForm({ dispatch }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    const task = {
      id: generateId(),
      title: trimmed,
      completed: false,
      date: date || null,
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: 'ADD_TASK', task });
    setTitle('');
    setDate('');
    inputRef.current?.focus();
  }

  return (
    <form data-testid="task-form" onSubmit={handleSubmit} className="task-form">
      <input
        ref={inputRef}
        data-testid="task-input"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a new task…"
        aria-label="Task title"
      />
      <input
        data-testid="task-date-input"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        aria-label="Due date"
      />
      <button data-testid="task-submit" type="submit" className="btn-submit">
        Add Task
      </button>
    </form>
  );
}
