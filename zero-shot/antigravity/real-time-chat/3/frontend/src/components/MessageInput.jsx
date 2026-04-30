import React, { useState } from 'react';

const MessageInput = ({ onSendMessage }) => {
  const [content, setContent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (content.trim()) {
      onSendMessage(content);
      setContent('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="message-input-form" onSubmit={handleSubmit}>
      <input
        type="text"
        data-testid="input-message"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
      />
      <button 
        type="submit" 
        data-testid="btn-send"
        disabled={content.length === 0}
      >
        Send
      </button>
    </form>
  );
};

export default MessageInput;
