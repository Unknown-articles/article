function Message({ message, currentUserId }) {
  const isOwn = message.userId === currentUserId;
  const displayUsername = isOwn ? 'You' : message.username;
  const time = new Date(message.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div data-testid="message-item" data-own={isOwn.toString()} data-message-id={message.id} className="message-item">
      <div data-testid="message-username">{displayUsername}</div>
      <div data-testid="message-content">{message.content}</div>
      <div data-testid="message-timestamp">{time}</div>
    </div>
  );
}

export default Message;