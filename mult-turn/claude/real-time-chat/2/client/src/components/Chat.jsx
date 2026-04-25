import { useState, useCallback } from 'react';
import { useSocketConnection } from '../useWebSocket';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

export default function Chat({ session, onLogout }) {
  const { token, user } = session;
  const [messages, setMessages] = useState([]);
  const [socketError, setSocketError] = useState('');

  const handleHistory = useCallback((msgs) => setMessages(msgs), []);
  const handleMessage = useCallback((msg) => setMessages(prev => [...prev, msg]), []);
  const handleError = useCallback((text) => setSocketError(text), []);
  const handleAuthFailure = useCallback(() => onLogout(), [onLogout]);

  const { isConnected, dispatch } = useSocketConnection({
    token,
    onHistory: handleHistory,
    onMessage: handleMessage,
    onError: handleError,
    onAuthFailure: handleAuthFailure,
  });

  function sendMessage(content) {
    setSocketError('');
    dispatch({ type: 'message', content });
  }

  return (
    <div data-testid="chat-container">
      <div>
        <span
          data-testid="connection-status"
          data-connected={String(isConnected)}
        >
          {isConnected ? 'Online' : 'Offline'}
        </span>
        <span data-testid="current-username">{user.username}</span>
        <button data-testid="btn-logout" onClick={onLogout}>Logout</button>
      </div>

      {socketError && (
        <div data-testid="connection-error">{socketError}</div>
      )}

      <MessageList messages={messages} currentUserId={user.userId} />
      <MessageInput onSend={sendMessage} disabled={!isConnected} />
    </div>
  );
}
