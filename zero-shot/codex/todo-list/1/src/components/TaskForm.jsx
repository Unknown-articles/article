import { useEffect, useRef, useState } from 'react';

export function TaskForm({ onSubmit }) {
  const titleInputRef = useRef(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  function handleSubmit(event) {
    event.preventDefault();

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      titleInputRef.current?.focus();
      return;
    }

    onSubmit({
      title: normalizedTitle,
      date,
    });

    setTitle('');
    setDate('');
    titleInputRef.current?.focus();
  }

  return (
    <form className="task-form" data-testid="task-form" onSubmit={handleSubmit}>
      <label className="field">
        <span className="field-label">Task title</span>
        <input
          ref={titleInputRef}
          className="text-input"
          data-testid="task-input"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs to get done?"
          type="text"
          value={title}
        />
      </label>

      <label className="field">
        <span className="field-label">Due date</span>
        <input
          className="text-input"
          data-testid="task-date-input"
          onChange={(event) => setDate(event.target.value)}
          type="date"
          value={date}
        />
      </label>

      <button className="primary-btn" data-testid="task-submit" type="submit">
        Add task
      </button>
    </form>
  );
}
