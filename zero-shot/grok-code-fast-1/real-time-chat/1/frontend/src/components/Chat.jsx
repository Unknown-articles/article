import { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

function Chat({ user, token, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3000?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError('');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'history') {
        setMessages(data.messages);
      } else if (data.type === 'message') {
        setMessages((prev) => [...prev, data]);
      } else if (data.type === 'error') {
        setError(data.message);
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      if (event.code === 4001 || event.code === 4002) {
        setError('Authentication failed');
        onLogout();
      } else {
        setError('Connection lost');
      }
    };

    ws.onerror = () => {
      setConnected(false);
      setError('Connection error');
    };

    return () => {
      ws.close();
    };
  }, [token, onLogout]);

  const sendMessage = (content) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', content }));
    }
  };

  return (
    <div data-testid="chat-container" className="chat-container">
      <div className="header">
        <div
          data-testid="connection-status"
          data-connected={connected.toString()}
          className={`status ${connected ? 'online' : 'offline'}`}
        >
          {connected ? 'Online' : 'Offline'}
        </div>
        <div data-testid="current-username">{user.username}</div>
        <button data-testid="btn-logout" onClick={onLogout} className="btn-secondary">
          Logout
        </button>
      </div>
      {error && <div data-testid="connection-error" className="error">{error}</div>}
      <MessageList messages={messages} currentUserId={user.userId} />
      <MessageInput onSend={sendMessage} />
    </div>
  );
}

export default Chat;