import { useState } from 'react';

export function MessageInput({ onSend }) {
  const [content, setContent] = useState('');
  const canSend = content.length > 0;

  function handleSubmit(event) {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    onSend(content);
    setContent('');
  }

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <input
        data-testid="input-message"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Message"
        aria-label="Message"
      />
      <button type="submit" data-testid="btn-send" disabled={!canSend}>
        Send
      </button>
    </form>
  );
}
