import { forwardRef } from 'react';
import Message from './Message';

const MessageList = forwardRef(({ messages, currentUserId }, ref) => {
  return (
    <div data-testid="message-list" className="message-list" ref={ref}>
      {messages.length === 0 && <div data-testid="message-empty">No messages yet</div>}
      {messages.map((message) => (
        <Message key={message.id} message={message} currentUserId={currentUserId} />
      ))}
    </div>
  );
});

export default MessageList;