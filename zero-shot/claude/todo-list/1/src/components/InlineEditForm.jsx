import { useState, useEffect, useRef } from 'react';

export default function InlineEditForm({ task, onSave, onCancel }) {
  const [title, setTitle] = useState(task.title);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      onCancel();
    }
    // Enter is handled by form submit
  }

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = title.trim();
    if (trimmed) {
      onSave({ ...task, title: trimmed });
    }
  }

  return (
    <form className="inline-edit-form" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        data-testid="inline-edit-input"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Edit task title"
      />
      <button type="submit" data-testid="inline-edit-save" className="btn-save">
        Save
      </button>
      <button
        type="button"
        data-testid="inline-edit-cancel"
        className="btn-cancel"
        onClick={onCancel}
      >
        Cancel
      </button>
    </form>
  );
}
