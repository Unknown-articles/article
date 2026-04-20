import { useState } from 'react';

export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState('');

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div>
      <input
        data-testid="input-message"
        type="text"
        value={text}
        placeholder="Type a message…"
        disabled={disabled}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        data-testid="btn-send"
        onClick={submit}
        disabled={disabled || text.trim().length === 0}
      >
        Send
      </button>
    </div>
  );
}
