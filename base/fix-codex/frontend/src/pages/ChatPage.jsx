import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { wsBaseUrl } from '../config.js';

export default function ChatPage() {
  const { accessToken, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  const wsUrl = accessToken ? `${wsBaseUrl}/ws/chat?token=${accessToken}` : null;

  const handleMessage = msg => {
    if (msg.type === 'history') {
      setMessages(msg.messages);
    } else if (msg.type === 'message') {
      setMessages(prev => [...prev, msg]);
    } else if (msg.type === 'system' || msg.type === 'error') {
      setMessages(prev => [
        ...prev,
        { ...msg, id: `${msg.type}-${msg.timestamp || Date.now()}` },
      ]);
    }
  };

  const { connected, send } = useWebSocket(wsUrl, handleMessage);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = event => {
    event.preventDefault();
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
        {messages.map((msg, index) => (
          <div key={msg.id || index} className={`chat-message ${msg.userId === user?.sub ? 'own' : ''} ${msg.type || 'message'}`}>
            <span className="chat-username">{msg.username || msg.type}</span>
            <span className="chat-content">{msg.content || msg.message}</span>
            <span className="chat-time">{new Date(msg.createdAt || msg.timestamp || Date.now()).toLocaleTimeString()}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="chat-input-form">
        <input
          value={input}
          onChange={event => setInput(event.target.value)}
          placeholder="Type a message..."
          disabled={!connected}
        />
        <button type="submit" className="btn btn-primary" disabled={!connected}>Send</button>
      </form>
    </main>
  );
}
