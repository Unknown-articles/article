import React, { useState } from 'react';

export default function MessageInput({ onSend }) {
  const [text, setText] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        data-testid="input-message"
        type="text"
        placeholder="Type a message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="submit"
        data-testid="btn-send"
        disabled={!text.trim()}
      >
        Send
      </button>
    </form>
  );
}
