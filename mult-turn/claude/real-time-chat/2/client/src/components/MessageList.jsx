import { useEffect, useRef } from 'react';
import Message from './Message';

export default function MessageList({ messages, currentUserId }) {
  const anchorRef = useRef(null);

  useEffect(() => {
    anchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div data-testid="message-list">
      {messages.length === 0 && (
        <div data-testid="message-empty">No messages yet.</div>
      )}
      {messages.map((msg) => (
        <Message key={msg.id} msg={msg} currentUserId={currentUserId} />
      ))}
      <div ref={anchorRef} />
    </div>
  );
}
