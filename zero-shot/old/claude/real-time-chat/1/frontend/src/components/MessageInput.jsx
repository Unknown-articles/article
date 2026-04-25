import { useState } from 'react';

export function MessageInput({ onSend, disabled }) {
  const [content, setContent] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = content.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setContent('');
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  }

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Connecting…' : 'Type a message… (Enter to send)'}
        disabled={disabled}
        maxLength={1000}
        autoComplete="off"
        data-testid="input-message"
      />
      <button
        type="submit"
        disabled={disabled || !content.trim()}
        data-testid="btn-send"
      >
        Send
      </button>
    </form>
  );
}
