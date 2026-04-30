import { useEffect, useRef } from 'react';
import Message from './Message.jsx';

export default function MessageList({ messages, currentUserId }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div data-testid="message-list" style={styles.list}>
      {messages.length === 0 ? (
        <p data-testid="message-empty" style={styles.empty}>
          No messages yet. Say hello!
        </p>
      ) : (
        messages.map((msg) => (
          <Message key={msg.id} message={msg} currentUserId={currentUserId} />
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

const styles = {
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    padding: '1rem',
  },
  empty: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: '2rem',
    fontSize: '0.9rem',
  },
};
