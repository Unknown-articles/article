function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Message({ message, isOwn }) {
  return (
    <article
      className={`message-item ${isOwn ? 'own' : ''}`}
      data-testid="message-item"
      data-own={String(isOwn)}
      data-message-id={message.id}
    >
      <div className="message-meta">
        <span data-testid="message-username">{isOwn ? 'You' : message.username}</span>
        <time data-testid="message-timestamp" dateTime={message.timestamp}>
          {formatTimestamp(message.timestamp)}
        </time>
      </div>
      <p data-testid="message-content">{message.content}</p>
    </article>
  );
}
