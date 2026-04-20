import { useState, useCallback } from 'react';
import { useWebSocket } from '../useWebSocket';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

export default function Chat({ session, onLogout }) {
  const { token, user } = session;
  const [messages, setMessages] = useState([]);
  const [connError, setConnError] = useState('');

  const onHistory = useCallback((msgs) => setMessages(msgs), []);
  const onMessage = useCallback((msg) => setMessages(prev => [...prev, msg]), []);
  const onError = useCallback((text) => setConnError(text), []);
  const onAuthFailure = useCallback(() => onLogout(), [onLogout]);

  const { connected, send } = useWebSocket({ token, onHistory, onMessage, onError, onAuthFailure });

  function handleSend(content) {
    setConnError('');
    send({ type: 'message', content });
  }

  return (
    <div data-testid="chat-container">
      <div>
        <span
          data-testid="connection-status"
          data-connected={String(connected)}
        >
          {connected ? 'Online' : 'Offline'}
        </span>
        <span data-testid="current-username">{user.username}</span>
        <button data-testid="btn-logout" onClick={onLogout}>Logout</button>
      </div>

      {connError && (
        <div data-testid="connection-error">{connError}</div>
      )}

      <MessageList messages={messages} currentUserId={user.userId} />
      <MessageInput onSend={handleSend} disabled={!connected} />
    </div>
  );
}
