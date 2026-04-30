import { useEffect, useRef } from 'react';
import { Message } from './Message.jsx';

export function MessageList({ messages, currentUserId }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section className="message-list" data-testid="message-list" ref={listRef}>
      {messages.length === 0 ? (
        <div className="message-empty" data-testid="message-empty">
          No messages yet.
        </div>
      ) : (
        messages.map((message) => (
          <Message key={message.id} message={message} currentUserId={currentUserId} />
        ))
      )}
    </section>
  );
}
