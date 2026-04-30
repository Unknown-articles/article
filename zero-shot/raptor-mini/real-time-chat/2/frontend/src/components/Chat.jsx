import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';

function Chat({ currentUsername, connectionError, connected, messages, onSend, onLogout, currentUserId }) {
  return (
    <div className="chat-shell" data-testid="chat-container">
      <div className="chat-header">
        <div>
          <strong data-testid="current-username">{currentUsername}</strong>
          <span
            data-testid="connection-status"
            data-connected={connected ? 'true' : 'false'}
            className={connected ? 'connected' : 'disconnected'}
          >
            {connected ? 'Online' : 'Offline'}
          </span>
        </div>
        <button data-testid="btn-logout" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>
      {connectionError ? (
        <div data-testid="connection-error" className="error-banner">{connectionError}</div>
      ) : null}
      <MessageList messages={messages} currentUserId={currentUserId} />
      <MessageInput onSend={onSend} />
    </div>
  );
}

export default Chat;
