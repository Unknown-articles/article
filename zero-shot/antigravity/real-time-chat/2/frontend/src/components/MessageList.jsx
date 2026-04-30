import { useEffect, useRef } from 'react';
import Message from './Message';

export default function MessageList({ messages, currentUserId }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="message-list" data-testid="message-list">
      {messages.length === 0 ? (
        <div className="message-empty" data-testid="message-empty">No messages yet.</div>
      ) : (
        messages.map(msg => (
          <Message key={msg.id || msg.timestamp} message={msg} currentUserId={currentUserId} />
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}
