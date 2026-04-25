import React, { useState, useEffect, useRef } from 'react';
import { useTasks } from '../context/TaskContext';
import './TaskForm.css';
import { Plus } from 'lucide-react';

export function TaskForm() {
  const { dispatch } = useTasks();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const inputRef = useRef(null);

  // Focus input on load
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask = {
      id: crypto.randomUUID(),
      title: title.trim(),
      date,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: 'ADD_TASK', payload: newTask });
    setTitle('');
    setDate('');
    
    // Kept focus on input after submit to easily add multiple tasks
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <form className="task-form" data-testid="task-form" onSubmit={handleSubmit}>
      <div className="task-input-group">
        <input
          ref={inputRef}
          type="text"
          data-testid="task-input"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="task-title-input"
        />
        <input
          type="date"
          data-testid="task-date-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="task-date-input"
        />
        <button type="submit" data-testid="task-submit" className="task-submit-btn" disabled={!title.trim()}>
          <Plus size={20} />
          <span>Add Task</span>
        </button>
      </div>
    </form>
  );
}
