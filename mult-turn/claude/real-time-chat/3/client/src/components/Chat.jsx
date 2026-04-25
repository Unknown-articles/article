import { useState, useCallback } from 'react';
import { useRealTimeConnection } from '../useWebSocket';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

export default function Chat({ session, onLogout }) {
  const { token, user } = session;
  const [messages, setMessages] = useState([]);
  const [wsError, setWsError] = useState('');

  const onLoadHistory = useCallback((msgs) => setMessages(msgs), []);
  const onReceive = useCallback((msg) => setMessages(prev => [...prev, msg]), []);
  const onSocketError = useCallback((text) => setWsError(text), []);
  const onExpired = useCallback(() => onLogout(), [onLogout]);

  const { isLive, emit } = useRealTimeConnection({
    token,
    onHistory: onLoadHistory,
    onMessage: onReceive,
    onError: onSocketError,
    onAuthFailure: onExpired,
  });

  function handleMessage(content) {
    setWsError('');
    emit({ type: 'message', content });
  }

  return (
    <div data-testid="chat-container">
      <div>
        <span
          data-testid="connection-status"
          data-connected={String(isLive)}
        >
          {isLive ? 'Online' : 'Offline'}
        </span>
        <span data-testid="current-username">{user.username}</span>
        <button data-testid="btn-logout" onClick={onLogout}>Logout</button>
      </div>

      {wsError && (
        <div data-testid="connection-error">{wsError}</div>
      )}

      <MessageList messages={messages} currentUserId={user.userId} />
      <MessageInput onSend={handleMessage} disabled={!isLive} />
    </div>
  );
}
