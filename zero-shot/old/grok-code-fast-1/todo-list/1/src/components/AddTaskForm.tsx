import { useState } from 'react';
import { Task } from '../types';

interface Props {
  onAdd: (task: Omit<Task, 'id' | 'createdAt'>) => void;
}

export function AddTaskForm({ onAdd }: Props) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onAdd({ title: title.trim(), completed: false, date: new Date(date) });
      setTitle('');
      setDate('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-task-form">
      <input
        type="text"
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />
      <button type="submit">Add Task</button>
    </form>
  );
}