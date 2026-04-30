import React, { useEffect, useRef } from 'react';
import Message from './Message.jsx';

export default function MessageList({ messages, currentUserId }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div data-testid="message-list" style={{ overflowY: 'auto', flex: 1 }}>
      {messages.length === 0 && (
        <div data-testid="message-empty">No messages yet. Say hello!</div>
      )}
      {messages.map((msg) => (
        <Message key={msg.id} message={msg} currentUserId={currentUserId} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
