export default function Message({ message, currentUserId }) {
  const own = message.userId === currentUserId
  const timestamp = new Date(message.timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div
      data-testid="message-item"
      data-own={own ? 'true' : 'false'}
      data-message-id={message.id}
      className={`message-item ${own ? 'own' : 'other'}`}
    >
      <div className="message-meta">
        <span data-testid="message-username" className="message-username">
          {own ? 'You' : message.username}
        </span>
        <span data-testid="message-timestamp" className="message-timestamp">
          {timestamp}
        </span>
      </div>
      <div data-testid="message-content" className="message-content">
        {message.content}
      </div>
    </div>
  )
}
