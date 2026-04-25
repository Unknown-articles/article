import { useEffect, useRef } from "react";
import { Message } from "./Message";

export function MessageList({ currentUserId, messages }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  return (
    <div data-testid="message-list" ref={listRef} className="message-list">
      {messages.length === 0 ? (
        <p data-testid="message-empty" className="message-empty">
          No messages yet. Start the conversation.
        </p>
      ) : (
        messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            currentUserId={currentUserId}
          />
        ))
      )}
    </div>
  );
}
