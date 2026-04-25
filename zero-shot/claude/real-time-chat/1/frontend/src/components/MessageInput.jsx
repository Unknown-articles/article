import { useState } from 'react';

export default function MessageInput({ onSend, disabled }) {
  const [content, setContent] = useState('');

  function submit() {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setContent('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="message-input-row">
      <input
        type="text"
        data-testid="input-message"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message…"
        disabled={disabled}
        autoComplete="off"
      />
      <button
        type="button"
        data-testid="btn-send"
        className="btn-send"
        onClick={submit}
        disabled={disabled || content.trim().length === 0}
      >
        Send
      </button>
    </div>
  );
}
