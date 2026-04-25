function Message({ message, isOwn }) {
  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      data-testid="message-item"
      data-own={isOwn.toString()}
      data-message-id={message.id}
      className={`message-item ${isOwn ? 'own' : 'other'}`}
    >
      <div data-testid="message-username">
        {isOwn ? 'You' : message.username}
      </div>
      <div data-testid="message-content">{message.content}</div>
      <div data-testid="message-timestamp">{formatTime(message.timestamp)}</div>
    </div>
  );
}

export default Message;