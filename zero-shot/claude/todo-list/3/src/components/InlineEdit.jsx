import { useState, useRef, useEffect } from 'react';

export default function InlineEdit({ task, onSave, onCancel }) {
  const [value, setValue] = useState(task.title);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const save = () => {
    const trimmed = value.trim();
    if (trimmed) onSave(trimmed);
    else onCancel();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  return (
    <div className="inline-edit">
      <input
        ref={inputRef}
        data-testid="inline-edit-input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="inline-edit-input"
      />
      <button data-testid="inline-edit-save" type="button" onClick={save} className="btn btn-small btn-primary">
        Save
      </button>
      <button data-testid="inline-edit-cancel" type="button" onClick={onCancel} className="btn btn-small">
        Cancel
      </button>
    </div>
  );
}
