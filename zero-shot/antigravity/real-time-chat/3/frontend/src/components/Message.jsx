import React from 'react';

const Message = ({ message, isOwn }) => {
  const { id, username, content, timestamp } = message;

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div 
      className={`message ${isOwn ? 'own-message' : 'other-message'}`} 
      data-testid="message-item"
      data-own={isOwn}
      data-message-id={id}
    >
      <div className="message-header">
        <span data-testid="message-username" className="username">
          {isOwn ? 'You' : username}
        </span>
        <span data-testid="message-timestamp" className="timestamp">
          {formatTime(timestamp)}
        </span>
      </div>
      <div data-testid="message-content" className="content">
        {content}
      </div>
    </div>
  );
};

export default Message;
