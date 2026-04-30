import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus } from 'lucide-react';

export function TaskForm({ dispatch }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    dispatch({
      type: 'ADD_TASK',
      payload: {
        id: uuidv4(),
        title: title.trim(),
        completed: false,
        date: date || null,
        createdAt: new Date().toISOString()
      }
    });

    setTitle('');
    setDate('');
    inputRef.current?.focus();
  };

  return (
    <form className="task-form" data-testid="task-form" onSubmit={handleSubmit}>
      <div className="input-group">
        <input
          ref={inputRef}
          type="text"
          className="input"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="task-input"
        />
        <input
          type="date"
          className="input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          data-testid="task-date-input"
        />
      </div>
      <button type="submit" className="btn" data-testid="task-submit">
        <Plus size={20} />
        Add Task
      </button>
    </form>
  );
}
