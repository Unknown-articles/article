import { useEffect, useRef, useState } from 'react';
import { MessageInput } from './MessageInput.jsx';
import { MessageList } from './MessageList.jsx';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';

export function Chat({ session, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE_URL}?token=${encodeURIComponent(session.token)}`);
    socketRef.current = ws;
    setConnectionError('');

    ws.addEventListener('open', () => {
      setIsConnected(true);
    });

    ws.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type === 'history') {
        setMessages(payload.messages);
      }

      if (payload.type === 'message') {
        setMessages((currentMessages) => [...currentMessages, payload]);
      }

      if (payload.type === 'error') {
        setConnectionError(payload.message);
      }
    });

    ws.addEventListener('close', (event) => {
      setIsConnected(false);

      if (event.code === 4001) {
        setConnectionError('Authentication required');
      } else if (event.code === 4002) {
        setConnectionError('Invalid or expired session');
      } else if (!event.wasClean) {
        setConnectionError('Connection lost');
      }
    });

    ws.addEventListener('error', () => {
      setConnectionError('Unable to connect to chat server');
    });

    return () => {
      ws.close();
    };
  }, [session.token]);

  function sendMessage(content) {
    const ws = socketRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setConnectionError('Chat is offline');
      return;
    }

    ws.send(JSON.stringify({ type: 'message', content }));
  }

  return (
    <div className="chat-shell" data-testid="chat-container">
      <header className="chat-header">
        <div>
          <span
            className={`status ${isConnected ? 'online' : 'offline'}`}
            data-testid="connection-status"
            data-connected={isConnected ? 'true' : 'false'}
          >
            {isConnected ? 'Online' : 'Offline'}
          </span>
          <strong data-testid="current-username">{session.user.username}</strong>
        </div>
        <button type="button" data-testid="btn-logout" onClick={onLogout}>
          Logout
        </button>
      </header>

      {connectionError ? (
        <div className="connection-error" data-testid="connection-error">
          {connectionError}
        </div>
      ) : null}

      <MessageList messages={messages} currentUserId={session.user.userId} />
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
