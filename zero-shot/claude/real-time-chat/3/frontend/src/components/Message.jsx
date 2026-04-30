export default function Message({ message, currentUserId }) {
  const isOwn = message.userId === currentUserId;

  const timeStr = (() => {
    try {
      const d = new Date(message.timestamp);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '';
    }
  })();

  return (
    <div
      data-testid="message-item"
      data-own={String(isOwn)}
      data-message-id={message.id}
      style={{
        ...styles.item,
        alignSelf: isOwn ? 'flex-end' : 'flex-start',
      }}
    >
      <span data-testid="message-username" style={styles.username}>
        {isOwn ? 'You' : message.username}
      </span>
      <div
        style={{
          ...styles.bubble,
          background: isOwn ? '#2563eb' : '#e5e7eb',
          color: isOwn ? '#fff' : '#111',
        }}
      >
        <span data-testid="message-content">{message.content}</span>
      </div>
      <span data-testid="message-timestamp" style={styles.time}>
        {timeStr}
      </span>
    </div>
  );
}

const styles = {
  item: {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '70%',
    gap: 2,
  },
  username: {
    fontSize: '0.75rem',
    color: '#6b7280',
    fontWeight: 600,
  },
  bubble: {
    padding: '0.5rem 0.8rem',
    borderRadius: 12,
    fontSize: '0.95rem',
    wordBreak: 'break-word',
  },
  time: {
    fontSize: '0.7rem',
    color: '#9ca3af',
  },
};
