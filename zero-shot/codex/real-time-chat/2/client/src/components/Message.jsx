function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function Message({ message, currentUserId }) {
  const isOwnMessage = message.userId === currentUserId;

  return (
    <article
      data-testid="message-item"
      data-own={isOwnMessage ? "true" : "false"}
      data-message-id={message.id}
      className={`message-item ${isOwnMessage ? "own" : ""}`}
    >
      <div className="message-meta">
        <span data-testid="message-username" className="message-username">
          {isOwnMessage ? "You" : message.username}
        </span>
        <time data-testid="message-timestamp" className="message-timestamp">
          {formatTimestamp(message.timestamp)}
        </time>
      </div>
      <p data-testid="message-content" className="message-content">
        {message.content}
      </p>
    </article>
  );
}
