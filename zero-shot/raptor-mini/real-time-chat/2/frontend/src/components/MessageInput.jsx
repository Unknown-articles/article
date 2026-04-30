import { useEffect, useState } from 'react';

function MessageInput({ onSend }) {
  const [value, setValue] = useState('');

  const handleSend = (event) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  };

  return (
    <form className="message-input-form" onSubmit={handleSend}>
      <input
        data-testid="input-message"
        type="text"
        placeholder="Type your message..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend(event);
          }
        }}
      />
      <button data-testid="btn-send" type="submit" disabled={value.trim().length === 0}>
        Send
      </button>
    </form>
  );
}

export default MessageInput;
