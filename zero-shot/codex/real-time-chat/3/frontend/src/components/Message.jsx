function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

export function Message({ message, currentUserId }) {
  const isOwn = message.userId === currentUserId;

  return (
    <article
      className={`message-item ${isOwn ? 'own' : ''}`}
      data-testid="message-item"
      data-own={isOwn ? 'true' : 'false'}
      data-message-id={message.id}
    >
      <div className="message-meta">
        <span data-testid="message-username">{isOwn ? 'You' : message.username}</span>
        <time dateTime={message.timestamp} data-testid="message-timestamp">
          {formatTime(message.timestamp)}
        </time>
      </div>
      <p data-testid="message-content">{message.content}</p>
    </article>
  );
}
