import React, { useState } from 'react';
import { useTask } from '../context/TaskContext';

export default function TaskInput() {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const { dispatch } = useTask();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    dispatch({
      type: 'ADD_TASK',
      payload: {
        id: crypto.randomUUID(),
        title: title.trim(),
        date: date || null,
        completed: false,
        createdAt: Date.now()
      }
    });

    setTitle('');
    setDate('');
  };

  return (
    <form className="task-input-form animate-slide-in" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <button type="submit" className="primary">Add Task</button>
    </form>
  );
}
