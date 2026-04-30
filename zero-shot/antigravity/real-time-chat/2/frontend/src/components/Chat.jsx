import { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

export default function Chat({ user, token, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3000?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'history') {
        setMessages(data.messages);
      } else if (data.type === 'message') {
        setMessages(prev => [...prev, data]);
      } else if (data.type === 'error') {
        setError(data.message);
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      if (event.code === 4001 || event.code === 4002) {
        onLogout();
      }
    };

    ws.onerror = () => {
      setError('Connection error');
    };

    return () => {
      ws.close();
    };
  }, [token, onLogout]);

  const handleSendMessage = (content) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', content }));
    }
  };

  return (
    <div className="chat-container" data-testid="chat-container">
      {error && <div className="connection-error" data-testid="connection-error">{error}</div>}
      <div className="chat-header">
        <div className="user-info">
          <div 
            className="connection-status" 
            data-testid="connection-status" 
            data-connected={connected}
          />
          <span data-testid="current-username">{user.username}</span>
        </div>
        <button onClick={onLogout} data-testid="btn-logout">Logout</button>
      </div>
      <MessageList messages={messages} currentUserId={user.userId} />
      <MessageInput onSendMessage={handleSendMessage} />
    </div>
  );
}
