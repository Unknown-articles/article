export default function Message({ msg, currentUserId }) {
  const isMine = msg.userId === currentUserId;
  const displayTime = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <div
      data-testid="message-item"
      data-own={String(isMine)}
      data-message-id={msg.id}
    >
      <span data-testid="message-username">{isMine ? 'You' : msg.username}</span>
      <span data-testid="message-content">{msg.content}</span>
      <span data-testid="message-timestamp">{displayTime}</span>
    </div>
  );
}
