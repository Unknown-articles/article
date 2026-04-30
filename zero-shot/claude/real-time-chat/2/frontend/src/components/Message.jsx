import React from 'react';

export default function Message({ message, currentUserId }) {
  const isOwn = message.userId === currentUserId;
  const time = new Date(message.timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div data-testid="message-item" data-own={String(isOwn)} data-message-id={message.id}>
      <span data-testid="message-username">{isOwn ? 'You' : message.username}</span>
      <span data-testid="message-content">{message.content}</span>
      <span data-testid="message-timestamp">{time}</span>
    </div>
  );
}
