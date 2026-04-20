export default function Message({ msg, currentUserId }) {
  const isOwn = msg.userId === currentUserId;
  const time = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <div
      data-testid="message-item"
      data-own={String(isOwn)}
      data-message-id={msg.id}
    >
      <span data-testid="message-username">{isOwn ? 'You' : msg.username}</span>
      <span data-testid="message-content">{msg.content}</span>
      <span data-testid="message-timestamp">{time}</span>
    </div>
  );
}
