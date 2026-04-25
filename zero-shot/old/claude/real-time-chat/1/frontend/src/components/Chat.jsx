import { useAuth } from '../context/AuthContext.jsx';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { MessageList } from './MessageList.jsx';
import { MessageInput } from './MessageInput.jsx';

export function Chat() {
  const { user, logout } = useAuth();
  const { messages, connected, error, sendMessage } = useWebSocket(user.token);

  return (
    <div className="chat-container" data-testid="chat-container">
      <header className="chat-header">
        <h2>Chat Room</h2>
        <div className="header-right">
          <span
            className={`status ${connected ? 'online' : 'offline'}`}
            data-testid="connection-status"
            data-connected={connected}
          >
            {connected ? 'Connected' : 'Reconnecting…'}
          </span>
          <span className="username-display" data-testid="current-username">
            {user.username}
          </span>
          <button className="logout-btn" onClick={logout} data-testid="btn-logout">
            Logout
          </button>
        </div>
      </header>

      {error && (
        <div className="connection-error" data-testid="connection-error">
          {error}
        </div>
      )}

      <MessageList messages={messages} currentUserId={user.userId} />

      <MessageInput onSend={sendMessage} disabled={!connected} />
    </div>
  );
}
