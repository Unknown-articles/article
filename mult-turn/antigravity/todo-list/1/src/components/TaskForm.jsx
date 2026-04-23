import { useState, useRef, useEffect } from 'react';

export default function TaskForm({ addTask }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Focus the input when the component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    addTask({
      title: title.trim(),
      date: date
    });

    setTitle('');
    setDate('');
    
    // Focus input after submission
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <form className="task-form glass-panel" onSubmit={handleSubmit} data-testid="task-form">
      <div className="form-row">
        <div className="input-group" style={{ flex: 2 }}>
          <input
            type="text"
            className="input-field"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            ref={inputRef}
            data-testid="task-input"
          />
        </div>
        <div className="input-group">
          <input
            type="date"
            className="input-field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="task-date-input"
          />
        </div>
        <button 
          type="submit" 
          className="submit-btn" 
          data-testid="task-submit"
          disabled={!title.trim()}
        >
          Add Task
        </button>
      </div>
    </form>
  );
}
