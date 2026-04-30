export default function Message({ message, currentUserId }) {
  const isOwn = message.userId === currentUserId;
  const date = new Date(message.timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeString = `${hours}:${minutes}`;
  
  return (
    <div className="message-item" data-testid="message-item" data-own={isOwn} data-message-id={message.id}>
      <div className="message-meta">
        <span data-testid="message-username">{isOwn ? 'You' : message.username}</span>
        <span data-testid="message-timestamp">{timeString}</span>
      </div>
      <div className="message-bubble" data-testid="message-content">
        {message.content}
      </div>
    </div>
  );
}
