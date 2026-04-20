import { useEffect, useRef } from "react";
import Message from "./Message.jsx";

function MessageList({ messages, currentUserId }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div data-testid="message-list" ref={listRef} className="message-list">
      {messages.length === 0 ? (
        <div data-testid="message-empty" className="message-empty">
          No messages yet.
        </div>
      ) : (
        messages.map((message) => (
          <Message key={message.id} message={message} currentUserId={currentUserId} />
        ))
      )}
    </div>
  );
}

export default MessageList;
