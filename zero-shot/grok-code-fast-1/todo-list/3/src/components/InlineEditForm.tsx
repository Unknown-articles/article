import { useState, useEffect, useRef } from 'react';

interface InlineEditFormProps {
  initialTitle: string;
  initialDate: string;
  onSave: (title: string, date: string) => void;
  onCancel: () => void;
}

export const InlineEditForm: React.FC<InlineEditFormProps> = ({
  initialTitle,
  initialDate,
  onSave,
  onCancel
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(initialDate);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(title.trim(), date);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <form data-testid="inline-edit-form" onSubmit={handleSubmit} className="inline-edit-form">
      <input
        data-testid="inline-edit-input"
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <button data-testid="inline-edit-save" type="submit">Save</button>
      <button data-testid="inline-edit-cancel" type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
};