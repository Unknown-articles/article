import { useEffect, useRef } from 'react';
import Message from './Message.jsx';

export default function MessageList({ messages, currentUserId }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div data-testid="message-list" className="message-list">
      {messages.length === 0 ? (
        <p data-testid="message-empty" className="message-empty">
          No messages yet. Say hello!
        </p>
      ) : (
        messages.map((msg) => (
          <Message key={msg.id} message={msg} currentUserId={currentUserId} />
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}
