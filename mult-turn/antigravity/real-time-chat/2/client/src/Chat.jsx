import React, { useState, useEffect, useRef } from 'react';
import './Chat.css';

export default function Chat({ currentUser, onLogout }) {
  const [chatHistory, setChatHistory] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const [error, setError] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  
  const wsRef = useRef(null);
  const messageListRef = useRef(null);

  const scrollToLatest = () => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToLatest();
  }, [chatHistory]);

  useEffect(() => {
    const token = localStorage.getItem('rtchat_token');
    const ws = new WebSocket(`ws://localhost:3000?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsOnline(true);
      setError('');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'history') {
          setChatHistory(data.messages);
        } else if (data.type === 'message') {
          setChatHistory((prev) => [...prev, data]);
        } else if (data.type === 'error') {
          setError(data.message);
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    };

    ws.onclose = (event) => {
      setIsOnline(false);
      if (event.code === 4001 || event.code === 4002) {
        onLogout();
      }
    };

    return () => {
      ws.close();
    };
  }, [onLogout]);

  const handleSend = () => {
    const trimmed = draftMessage.trim();
    if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({ type: 'message', content: trimmed }));
    setDraftMessage('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTimestamp = (isoString) => {
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
            className={`status-indicator ${isOnline ? 'online' : 'offline'}`}
            data-testid="connection-status"
            data-isOnline={isOnline.toString()}
          />
          <span className="current-username" data-testid="current-username">
            {currentUser.username}
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
        {chatHistory.length === 0 ? (
          <div className="message-empty" data-testid="message-empty">
            No chatHistory yet
          </div>
        ) : (
          chatHistory.map((msg) => {
            const isOwn = msg.userId === currentUser.userId;
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
                    {formatTimestamp(msg.timestamp)}
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
          value={draftMessage}
          onChange={(e) => setDraftMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
        />
        <button
          className="btn-send"
          data-testid="btn-send"
          onClick={handleSend}
          disabled={draftMessage.length === 0}
        >
          Send
        </button>
      </div>
    </div>
  );
}

