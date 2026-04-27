import React from 'react';

function Message({ message, isOwn }) {
  const formatTime = (iso) => {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div data-testid="message-item" data-own={isOwn.toString()} data-message-id={message.id}>
      <div data-testid="message-username">{isOwn ? 'You' : message.username}</div>
      <div data-testid="message-content">{message.content}</div>
      <div data-testid="message-timestamp">{formatTime(message.timestamp)}</div>
    </div>
  );
}

export default Message;