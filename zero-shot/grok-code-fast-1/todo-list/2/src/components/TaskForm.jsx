import { useState, useRef, useEffect } from 'react';

const TaskForm = ({ onSubmit }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const inputRef = useRef();

  useEffect(() => {
    inputRef.current.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (title.trim()) {
      onSubmit(title.trim(), new Date(date || Date.now()));
      setTitle('');
      setDate('');
    }
  };

  return (
    <form data-testid="task-form" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        data-testid="task-input"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
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

export default TaskForm;