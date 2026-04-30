import useWebSocket from '../hooks/useWebSocket.js';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';

export default function Chat({ session, onLogout }) {
  const { messages, connected, error, sendMessage } = useWebSocket(session.token);

  return (
    <div data-testid="chat-container" style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span
            data-testid="connection-status"
            data-connected={String(connected)}
            style={{
              ...styles.dot,
              background: connected ? '#22c55e' : '#ef4444',
            }}
          />
          <span style={styles.statusText}>{connected ? 'Online' : 'Offline'}</span>
        </div>
        <span data-testid="current-username" style={styles.username}>
          {session.username}
        </span>
        <button data-testid="btn-logout" onClick={onLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </header>

      {error && (
        <div data-testid="connection-error" style={styles.errorBanner}>
          {error}
        </div>
      )}

      <MessageList messages={messages} currentUserId={session.userId} />

      <MessageInput onSend={sendMessage} disabled={!connected} />
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: 700,
    height: '90vh',
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    display: 'inline-block',
  },
  statusText: {
    fontSize: '0.85rem',
    color: '#6b7280',
  },
  username: {
    fontWeight: 600,
    fontSize: '0.95rem',
    color: '#111',
    marginRight: '0.5rem',
  },
  logoutBtn: {
    padding: '0.3rem 0.8rem',
    background: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: '0.8rem',
    cursor: 'pointer',
    color: '#6b7280',
  },
  errorBanner: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    borderBottom: '1px solid #fecaca',
  },
};
