import { useMemo } from "react";

function formatTime(timestamp) {
  try {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  } catch {
    return "--:--";
  }
}

function Message({ message, currentUserId }) {
  const own = message.userId === currentUserId;
  const displayName = own ? "You" : message.username;
  const time = useMemo(() => formatTime(message.timestamp), [message.timestamp]);

  return (
    <div
      data-testid="message-item"
      data-own={own ? "true" : "false"}
      data-message-id={message.id}
      className={`message-item ${own ? "own" : "other"}`}
    >
      <div data-testid="message-username" className="message-username">
        {displayName}
      </div>
      <div data-testid="message-content" className="message-content">
        {message.content}
      </div>
      <div data-testid="message-timestamp" className="message-timestamp">
        {time}
      </div>
    </div>
  );
}

export default Message;
