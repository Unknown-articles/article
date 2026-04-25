import { useState } from 'react';

export default function MessageInput({ onSend, disabled }) {
  const [inputValue, setInputValue] = useState('');

  function sendMsg() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInputValue('');
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  }

  return (
    <div>
      <input
        data-testid="input-message"
        type="text"
        value={inputValue}
        placeholder="Type a message…"
        disabled={disabled}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <button
        data-testid="btn-send"
        onClick={sendMsg}
        disabled={disabled || inputValue.trim().length === 0}
      >
        Send
      </button>
    </div>
  );
}
