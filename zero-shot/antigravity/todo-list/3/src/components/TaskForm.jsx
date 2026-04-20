import React, { useState, useEffect, useRef } from 'react';
import { useTaskContext } from '../store/TaskContext';

export default function TaskForm() {
  const { dispatch } = useTaskContext();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    dispatch({
      type: 'ADD_TASK',
      payload: {
        title: title.trim(),
        date,
        completed: false
      }
    });
    
    setTitle('');
    setDate('');
  };

  return (
    <form className="task-form" onSubmit={handleSubmit} data-testid="task-form">
      <input
        type="text"
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        ref={inputRef}
        data-testid="task-input"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        data-testid="task-date-input"
      />
      <button type="submit" data-testid="task-submit">
        Add Task
      </button>
    </form>
  );
}
