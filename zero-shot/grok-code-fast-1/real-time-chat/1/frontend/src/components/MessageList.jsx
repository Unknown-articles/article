import { useRef, useEffect } from 'react';
import Message from './Message';

function MessageList({ messages, currentUserId }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div data-testid="message-list" className="message-list" ref={listRef}>
      {messages.length === 0 ? (
        <div data-testid="message-empty" className="empty-state">
          No messages yet. Start the conversation!
        </div>
      ) : (
        messages.map((msg) => (
          <Message key={msg.id} message={msg} isOwn={msg.userId === currentUserId} />
        ))
      )}
    </div>
  );
}

export default MessageList;