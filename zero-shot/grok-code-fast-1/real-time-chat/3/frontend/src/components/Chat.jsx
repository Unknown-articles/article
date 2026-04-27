import React, { useState, useEffect, useRef } from 'react';
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
        setMessages(prev => [...prev, data]);
      } else if (data.type === 'error') {
        setError(data.message);
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      if (event.code === 4001 || event.code === 4002) {
        setError('Authentication failed');
      } else {
        setError('Connection lost');
      }
    };

    ws.onerror = () => {
      setError('Connection error');
    };

    return () => {
      ws.close();
    };
  }, [token]);

  const sendMessage = (content) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', content }));
    }
  };

  return (
    <div data-testid="chat-container">
      <div data-testid="connection-status" data-connected={connected.toString()}>
        {connected ? 'Online' : 'Offline'}
      </div>
      <div data-testid="current-username">{user.username}</div>
      <button data-testid="btn-logout" onClick={onLogout}>Logout</button>
      {error && <div data-testid="connection-error">{error}</div>}
      <MessageList messages={messages} currentUserId={user.userId} />
      <MessageInput onSend={sendMessage} />
    </div>
  );
}

export default Chat;