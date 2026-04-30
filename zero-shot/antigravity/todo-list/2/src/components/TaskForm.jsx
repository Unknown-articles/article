import { useState, useRef, useEffect } from 'react';
import { useTodo, ADD_TASK } from '../TodoContext';

export default function TaskForm() {
  const { dispatch } = useTodo();
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
      type: ADD_TASK,
      payload: {
        title: title.trim(),
        date: date || null
      }
    });
    
    setTitle('');
    setDate('');
    inputRef.current?.focus();
  };

  return (
    <form className="task-form" onSubmit={handleSubmit} data-testid="task-form">
      <input
        ref={inputRef}
        type="text"
        className="task-input"
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        data-testid="task-input"
      />
      <input
        type="date"
        className="task-date-input"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        data-testid="task-date-input"
      />
      <button type="submit" className="btn-submit" data-testid="task-submit">
        Add Task
      </button>
    </form>
  );
}
