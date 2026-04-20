import { useState } from 'react';

function MessageInput({ onSend }) {
  const [content, setContent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (content.trim()) {
      onSend(content.trim());
      setContent('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="message-input">
      <input
        data-testid="input-message"
        type="text"
        placeholder="Type a message..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyPress={handleKeyPress}
      />
      <button
        data-testid="btn-send"
        type="submit"
        disabled={!content.trim()}
        className="btn-primary"
      >
        Send
      </button>
    </form>
  );
}

export default MessageInput;