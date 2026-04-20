import { useWebSocket } from '../hooks/useWebSocket.js';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';

export default function Chat({ token, user, onLogout }) {
  const { messages, connected, error, sendMessage } = useWebSocket(token);

  return (
    <div data-testid="chat-container" className="chat-wrapper">
      <header className="chat-header">
        <div className="chat-header-left">
          <span
            data-testid="connection-status"
            data-connected={connected ? 'true' : 'false'}
            className={`status-dot ${connected ? 'online' : ''}`}
            title={connected ? 'Connected' : 'Disconnected'}
          />
          <span className="status-label">{connected ? 'Online' : 'Offline'}</span>
        </div>

        <span data-testid="current-username" className="current-username">
          {user.username}
        </span>

        <button
          type="button"
          data-testid="btn-logout"
          className="btn-logout"
          onClick={onLogout}
        >
          Logout
        </button>
      </header>

      {error && (
        <div data-testid="connection-error" className="connection-error-banner">
          {error}
        </div>
      )}

      <MessageList messages={messages} currentUserId={user.userId} />

      <MessageInput onSend={sendMessage} disabled={!connected} />
    </div>
  );
}
