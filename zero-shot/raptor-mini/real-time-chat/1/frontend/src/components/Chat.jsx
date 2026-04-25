import MessageList from "./MessageList.jsx";
import MessageInput from "./MessageInput.jsx";

function Chat({ user, messages, connected, connectionError, onLogout, onSendMessage, currentUserId }) {
  return (
    <div data-testid="chat-container" className="chat-shell">
      <div className="chat-header">
        <div className="status-row">
          <span data-testid="connection-status" data-connected={connected ? "true" : "false"}>
            {connected ? "Online" : "Offline"}
          </span>
          <span data-testid="current-username">{user.username}</span>
        </div>
        <button data-testid="btn-logout" className="logout-button" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>

      {connectionError ? (
        <div data-testid="connection-error" className="connection-error">
          {connectionError}
        </div>
      ) : null}

      <MessageList messages={messages} currentUserId={currentUserId} />
      <MessageInput onSendMessage={onSendMessage} />
    </div>
  );
}

export default Chat;
