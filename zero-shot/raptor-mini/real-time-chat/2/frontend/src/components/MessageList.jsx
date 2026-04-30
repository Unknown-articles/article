import { useEffect, useRef } from 'react';
import Message from './Message.jsx';

function MessageList({ messages, currentUserId }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="message-list" data-testid="message-list" ref={listRef}>
      {messages.length === 0 ? (
        <div data-testid="message-empty" className="empty-state">
          No messages yet. Say hello.
        </div>
      ) : (
        messages.map((message) => (
          <Message key={message.id} message={message} isOwn={message.userId === currentUserId} />
        ))
      )}
    </div>
  );
}

export default MessageList;
