import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { config } from '../config.js';

export default function ChatPage() {
  const { accessToken, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  const wsUrl = accessToken ? `${config.wsUrl}/ws/chat?token=${accessToken}` : null;

  const handleMessage = msg => {
    if (msg.type === 'history') {
      setMessages(msg.messages);
    } else if (msg.type === 'message') {
      setMessages(prev => [...prev, msg]);
    }
    // system messages and errors are ignored in the list
  };

  const { connected, send } = useWebSocket(wsUrl, handleMessage);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = e => {
    e.preventDefault();
    if (!input.trim()) return;
    send({ type: 'message', content: input.trim() });
    setInput('');
  };

  return (
    <main className="page chat-page">
      <div className="chat-header">
        <h1>Chat</h1>
        <span className={`status ${connected ? 'online' : 'offline'}`}>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={msg.id || i} className={`chat-message ${msg.userId === user?.sub ? 'own' : ''}`}>
            <span className="chat-username">{msg.username}</span>
            <span className="chat-content">{msg.content}</span>
            <span className="chat-time">{new Date(msg.createdAt || msg.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="chat-input-form">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={!connected}
        />
        <button type="submit" className="btn btn-primary" disabled={!connected}>Send</button>
      </form>
    </main>
  );
}
