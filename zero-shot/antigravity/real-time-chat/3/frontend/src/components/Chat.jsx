import React, { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

const Chat = ({ token, user, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const ws = useRef(null);

  useEffect(() => {
    // Initialize WebSocket
    const connectWs = () => {
      const port = 5000; // configurable
      const wsUrl = `ws://localhost:${port}?token=${token}`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'history') {
            setMessages(data.messages);
          } else if (data.type === 'message') {
            setMessages((prev) => [...prev, data]);
          } else if (data.type === 'error') {
            setConnectionError(data.message);
          }
        } catch (err) {
          console.error("Failed to parse message", err);
        }
      };

      ws.current.onclose = (event) => {
        setIsConnected(false);
        if (event.code === 4001 || event.code === 4002) {
            onLogout();
        } else {
            setConnectionError('Connection lost. Reconnecting...');
            // In a real app, we might want to implement reconnect with exponential backoff
        }
      };

      ws.current.onerror = () => {
        setIsConnected(false);
        setConnectionError('WebSocket connection error.');
      };
    };

    connectWs();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [token, onLogout]);

  const handleSendMessage = (content) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'message', content }));
    } else {
      setConnectionError('Cannot send message. Not connected to server.');
    }
  };

  return (
    <div data-testid="chat-container" className="chat-container">
      <header className="chat-header">
        <div className="user-info">
          <span data-testid="current-username" className="username">{user.username}</span>
          <span 
            data-testid="connection-status" 
            data-connected={isConnected}
            className={`status \${isConnected ? 'online' : 'offline'}`}
          >
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>
        <button data-testid="btn-logout" onClick={onLogout} className="logout-btn">
          Logout
        </button>
      </header>

      {connectionError && (
        <div data-testid="connection-error" className="connection-error">
          {connectionError}
        </div>
      )}

      <main className="chat-main">
        <MessageList messages={messages} currentUserId={user.userId} />
      </main>
      
      <footer className="chat-footer">
        <MessageInput onSendMessage={handleSendMessage} />
      </footer>
    </div>
  );
};

export default Chat;
