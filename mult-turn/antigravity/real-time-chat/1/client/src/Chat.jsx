import React, { useState, useEffect, useRef } from 'react';
import './Chat.css';

export default function Chat({ user, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [inputValue, setInputValue] = useState('');
  
  const wsRef = useRef(null);
  const messageListRef = useRef(null);

  const scrollToBottom = () => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const token = localStorage.getItem('chat_token');
    const ws = new WebSocket(`ws://localhost:3000?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError('');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'history') {
          setMessages(data.messages);
        } else if (data.type === 'message') {
          setMessages((prev) => [...prev, data]);
        } else if (data.type === 'error') {
          setError(data.message);
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      if (event.code === 4001 || event.code === 4002) {
        onLogout();
      }
    };

    return () => {
      ws.close();
    };
  }, [onLogout]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({ type: 'message', content: trimmed }));
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    let hours = date.getHours();
    let minutes = date.getMinutes();
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes}`;
  };

  return (
    <div className="chat-container" data-testid="chat-container">
      <div className="chat-header">
        <div className="chat-header-left">
          <div 
            className={`status-indicator ${connected ? 'online' : 'offline'}`}
            data-testid="connection-status"
            data-connected={connected.toString()}
          />
          <span className="current-username" data-testid="current-username">
            {user.username}
          </span>
        </div>
        <button 
          className="logout-btn" 
          data-testid="btn-logout" 
          onClick={onLogout}
        >
          Logout
        </button>
      </div>

      {error && (
        <div className="connection-error" data-testid="connection-error">
          {error}
        </div>
      )}

      <div className="message-list" data-testid="message-list" ref={messageListRef}>
        {messages.length === 0 ? (
          <div className="message-empty" data-testid="message-empty">
            No messages yet
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.userId === user.userId;
            return (
              <div 
                key={msg.id} 
                className={`message-item ${isOwn ? 'own' : 'other'}`}
                data-testid="message-item"
                data-own={isOwn.toString()}
                data-message-id={msg.id}
              >
                <div className="message-meta">
                  <span className="message-username" data-testid="message-username">
                    {isOwn ? 'You' : msg.username}
                  </span>
                  <span className="message-timestamp" data-testid="message-timestamp">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div className="message-content" data-testid="message-content">
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="message-input-container">
        <input
          type="text"
          className="input-message"
          data-testid="input-message"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
        />
        <button
          className="btn-send"
          data-testid="btn-send"
          onClick={handleSend}
          disabled={inputValue.length === 0}
        >
          Send
        </button>
      </div>
    </div>
  );
}
