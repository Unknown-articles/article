import { useEffect, useRef } from 'react';
import Message from './Message.jsx';

export default function MessageList({ messages, currentUserId }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="message-list" data-testid="message-list" ref={listRef}>
      {messages.length === 0 ? (
        <div className="empty-state" data-testid="message-empty">
          No messages yet.
        </div>
      ) : (
        messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            isOwn={Number(message.userId) === Number(currentUserId)}
          />
        ))
      )}
    </div>
  );
}
