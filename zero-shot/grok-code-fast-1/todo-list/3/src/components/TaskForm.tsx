import { useState, useEffect, useRef } from 'react';
import type { Action } from '../types';

interface TaskFormProps {
  dispatch: (action: Action) => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ dispatch }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      dispatch({
        type: 'ADD_TASK',
        payload: { title: title.trim(), completed: false, date }
      });
      setTitle('');
      setDate('');
      titleRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form data-testid="task-form" onSubmit={handleSubmit} className="task-form">
      <input
        data-testid="task-input"
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter task title"
        required
      />
      <input
        data-testid="task-date-input"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <button data-testid="task-submit" type="submit">Add Task</button>
    </form>
  );
};