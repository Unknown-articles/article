import { useState } from 'react';

export default function MessageInput({ onSendMessage }) {
  const [content, setContent] = useState('');

  const handleSend = () => {
    if (content.trim()) {
      onSendMessage(content.trim());
      setContent('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="chat-input-container">
      <input 
        type="text" 
        value={content} 
        onChange={e => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        data-testid="input-message"
      />
      <button 
        onClick={handleSend} 
        disabled={content.length === 0}
        data-testid="btn-send"
      >
        Send
      </button>
    </div>
  );
}
