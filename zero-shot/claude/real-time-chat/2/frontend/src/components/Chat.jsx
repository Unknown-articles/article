import React from 'react';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';
import { useWebSocket } from '../hooks/useWebSocket.js';

export default function Chat({ token, user, onLogout }) {
  const { messages, connected, error, sendMessage } = useWebSocket(token);

  return (
    <div data-testid="chat-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div>
        <span
          data-testid="connection-status"
          data-connected={String(connected)}
        >
          {connected ? 'Online' : 'Offline'}
        </span>
        <span data-testid="current-username">{user.username}</span>
        <button data-testid="btn-logout" onClick={onLogout}>
          Logout
        </button>
      </div>
      {error && <div data-testid="connection-error">{error}</div>}
      <MessageList messages={messages} currentUserId={user.userId} />
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
