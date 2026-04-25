import { useState } from 'react';

export default function MessageInput({ onSend, disabled }) {
  const [draft, setDraft] = useState('');

  function postMessage() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft('');
  }

  function handleKeyStroke(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      postMessage();
    }
  }

  return (
    <div>
      <input
        data-testid="input-message"
        type="text"
        value={draft}
        placeholder="Type a message…"
        disabled={disabled}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKeyStroke}
      />
      <button
        data-testid="btn-send"
        onClick={postMessage}
        disabled={disabled || draft.trim().length === 0}
      >
        Send
      </button>
    </div>
  );
}
