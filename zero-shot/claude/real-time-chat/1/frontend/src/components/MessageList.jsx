import { useEffect, useRef } from 'react';
import { Message } from './Message.jsx';

export function MessageList({ messages, currentUserId }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="message-list empty" data-testid="message-list">
        <p data-testid="message-empty">No messages yet. Say hello!</p>
      </div>
    );
  }

  return (
    <div className="message-list" data-testid="message-list">
      {messages.map((msg) => (
        <Message
          key={msg.id}
          message={msg}
          isOwn={msg.userId === currentUserId}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
