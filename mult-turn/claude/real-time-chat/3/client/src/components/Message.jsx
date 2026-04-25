export default function Message({ msg, currentUserId }) {
  const selfMessage = msg.userId === currentUserId;
  const msgTime = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <div
      data-testid="message-item"
      data-own={String(selfMessage)}
      data-message-id={msg.id}
    >
      <span data-testid="message-username">{selfMessage ? 'You' : msg.username}</span>
      <span data-testid="message-content">{msg.content}</span>
      <span data-testid="message-timestamp">{msgTime}</span>
    </div>
  );
}
