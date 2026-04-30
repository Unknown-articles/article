function formatTime(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
}

function Message({ message, isOwn }) {
  return (
    <div
      className={`message-item ${isOwn ? 'own' : 'other'}`}
      data-testid="message-item"
      data-own={isOwn ? 'true' : 'false'}
      data-message-id={message.id}
    >
      <div className="message-meta">
        <span data-testid="message-username">{isOwn ? 'You' : message.username}</span>
        <span data-testid="message-timestamp">{formatTime(message.timestamp)}</span>
      </div>
      <div data-testid="message-content" className="message-content">
        {message.content}
      </div>
    </div>
  );
}

export default Message;
