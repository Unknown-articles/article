import { useEffect, useMemo, useRef, useState } from 'react';
import MessageInput from './MessageInput.jsx';
import MessageList from './MessageList.jsx';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';

export default function Chat({ session, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const socketRef = useRef(null);

  const wsUrl = useMemo(() => {
    return `${WS_URL}?token=${encodeURIComponent(session.token)}`;
  }, [session.token]);

  useEffect(() => {
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;
    setConnectionError('');
    setIsConnected(false);

    socket.addEventListener('open', () => {
      setIsConnected(true);
    });

    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type === 'history') {
        setMessages(payload.messages);
        return;
      }

      if (payload.type === 'message') {
        setMessages((currentMessages) => [...currentMessages, payload]);
        return;
      }

      if (payload.type === 'error') {
        setConnectionError(payload.message);
      }
    });

    socket.addEventListener('close', (event) => {
      setIsConnected(false);
      if (event.code === 4001 || event.code === 4002) {
        setConnectionError('Your session expired. Please log in again.');
      } else if (!event.wasClean) {
        setConnectionError('Connection lost. Reconnecting requires a refresh.');
      }
    });

    socket.addEventListener('error', () => {
      setConnectionError('Unable to connect to the chat server');
    });

    return () => {
      socket.close();
    };
  }, [wsUrl]);

  function handleSend(content) {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setConnectionError('You are offline. Message was not sent.');
      return false;
    }

    socketRef.current.send(JSON.stringify({ type: 'message', content }));
    return true;
  }

  return (
    <div className="chat-layout" data-testid="chat-container">
      <header className="chat-header">
        <div>
          <span
            className={`status-pill ${isConnected ? 'online' : 'offline'}`}
            data-testid="connection-status"
            data-connected={String(isConnected)}
          >
            {isConnected ? 'Online' : 'Offline'}
          </span>
          <strong data-testid="current-username">{session.user.username}</strong>
        </div>
        <button data-testid="btn-logout" type="button" onClick={onLogout}>
          Logout
        </button>
      </header>

      {connectionError ? (
        <div className="error-banner" data-testid="connection-error" role="alert">
          {connectionError}
        </div>
      ) : null}

      <MessageList messages={messages} currentUserId={session.user.userId} />
      <MessageInput onSend={handleSend} />
    </div>
  );
}
