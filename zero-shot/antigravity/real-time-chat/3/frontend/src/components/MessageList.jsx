import React, { useEffect, useRef } from 'react';
import Message from './Message';

const MessageList = ({ messages, currentUserId }) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="message-list-container">
      {messages.length === 0 ? (
        <div data-testid="message-empty" className="empty-state">
          No messages yet. Be the first to say hi!
        </div>
      ) : (
        <div data-testid="message-list" className="message-list">
          {messages.map((msg) => (
            <Message 
              key={msg.id} 
              message={msg} 
              isOwn={msg.userId === currentUserId} 
            />
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
};

export default MessageList;
