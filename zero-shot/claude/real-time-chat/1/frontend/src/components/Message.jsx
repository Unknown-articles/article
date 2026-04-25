function formatTime(isoString) {
  const date = new Date(isoString);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function Message({ message, currentUserId }) {
  const isOwn = message.userId === currentUserId;

  return (
    <div
      data-testid="message-item"
      data-own={isOwn ? 'true' : 'false'}
      data-message-id={message.id}
      className="message-item"
    >
      <div className="message-meta">
        <span data-testid="message-username" className="message-username">
          {isOwn ? 'You' : message.username}
        </span>
        <span data-testid="message-timestamp" className="message-timestamp">
          {formatTime(message.timestamp)}
        </span>
      </div>
      <div data-testid="message-content" className="message-bubble">
        {message.content}
      </div>
    </div>
  );
}
