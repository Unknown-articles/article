import MessageList from './MessageList'
import MessageInput from './MessageInput'

export default function Chat({ user, messages, connected, connectionError, onLogout, onSendMessage }) {
  return (
    <div data-testid="chat-container" className="chat-container">
      <div className="chat-header">
        <div className="status-block">
          <span data-testid="connection-status" data-connected={connected ? 'true' : 'false'}>
            {connected ? 'Online' : 'Offline'}
          </span>
          <span data-testid="current-username" className="current-user">
            {user.username}
          </span>
        </div>

        <button data-testid="btn-logout" className="secondary-button" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>

      {connectionError ? (
        <div data-testid="connection-error" className="connection-error">
          {connectionError}
        </div>
      ) : null}

      <MessageList messages={messages} currentUserId={user.userId} />
      <MessageInput onSend={onSendMessage} />
    </div>
  )
}
