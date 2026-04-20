export function Message({ message, isOwn }) {
  const time = new Date(message.timestamp + (message.timestamp.endsWith('Z') ? '' : 'Z'))
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`message${isOwn ? ' own' : ''}`}
      data-testid="message-item"
      data-own={isOwn}
      data-message-id={message.id}
    >
      <div className="message-header">
        <span className="username" data-testid="message-username">
          {isOwn ? 'You' : message.username}
        </span>
        <span className="timestamp" data-testid="message-timestamp">{time}</span>
      </div>
      <div className="message-content" data-testid="message-content">
        {message.content}
      </div>
    </div>
  );
}
