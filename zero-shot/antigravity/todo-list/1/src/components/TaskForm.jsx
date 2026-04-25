import React, { useState, useRef, useEffect, useContext } from 'react';
import { TodoContext } from '../App';
import { Plus } from 'lucide-react';

export default function TaskForm() {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const inputRef = useRef(null);
  const { dispatch } = useContext(TodoContext);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask = {
      id: crypto.randomUUID(),
      title: title.trim(),
      completed: false,
      date: date || null,
      createdAt: new Date().toISOString()
    };

    dispatch({
      type: 'ADD_TASK',
      payload: newTask,
      description: `Added task: "${newTask.title}"`
    });

    setTitle('');
    setDate('');
    inputRef.current?.focus();
  };

  return (
    <form className="task-form" onSubmit={handleSubmit} data-testid="task-form">
      <div className="input-group">
        <input
          type="text"
          className="task-input"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          ref={inputRef}
          data-testid="task-input"
        />
        <input
          type="date"
          className="task-date-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          data-testid="task-date-input"
        />
      </div>
      <button type="submit" className="submit-btn" data-testid="task-submit" disabled={!title.trim()}>
        <Plus size={20} /> Add Task
      </button>
    </form>
  );
}
