import { useRef, useEffect, useState } from 'react';

export default function TaskForm({ onAdd }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, date || null);
    setTitle('');
    setDate('');
    inputRef.current?.focus();
  };

  return (
    <form data-testid="task-form" onSubmit={handleSubmit} className="task-form">
      <input
        ref={inputRef}
        data-testid="task-input"
        type="text"
        placeholder="Add a new task…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="task-input"
      />
      <input
        data-testid="task-date-input"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="task-date-input"
      />
      <button data-testid="task-submit" type="submit" className="btn btn-primary">
        Add
      </button>
    </form>
  );
}
