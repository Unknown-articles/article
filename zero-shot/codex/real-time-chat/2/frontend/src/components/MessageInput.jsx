import { useState } from 'react';

export default function MessageInput({ onSend }) {
  const [content, setContent] = useState('');

  function handleSubmit(event) {
    event.preventDefault();

    if (!content) {
      return;
    }

    const sent = onSend(content);
    if (sent) {
      setContent('');
    }
  }

  return (
    <form className="message-composer" onSubmit={handleSubmit}>
      <input
        data-testid="input-message"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Message"
        autoComplete="off"
      />
      <button data-testid="btn-send" type="submit" disabled={content.length === 0}>
        Send
      </button>
    </form>
  );
}
