import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { WS_URL } from '../config.js';

export default function ChatPage() {
  const { accessToken, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  const wsUrl = accessToken ? `${WS_URL}/ws/chat?token=${accessToken}` : null;

  const handleMessage = msg => {
    if (msg.type === 'history') {
      setMessages(msg.messages);
    } else if (msg.type === 'message') {
      setMessages(prev => [...prev, msg]);
    } else if (msg.type === 'system' || msg.type === 'error') {
      setMessages(prev => [...prev, { ...msg, id: msg.id || `sys-${Date.now()}` }]);
    }
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
        {messages.map((msg, i) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id || i} className="chat-system">
                <span>{msg.message}</span>
              </div>
            );
          }
          if (msg.type === 'error') {
            return (
              <div key={msg.id || i} className="chat-system chat-system-error">
                <span>{msg.message}</span>
              </div>
            );
          }
          return (
            <div key={msg.id || i} className={`chat-message ${msg.userId === user?.id ? 'own' : ''}`}>
              <span className="chat-username">{msg.username}</span>
              <span className="chat-content">{msg.content}</span>
              <span className="chat-time">{new Date(msg.createdAt || msg.timestamp).toLocaleTimeString()}</span>
            </div>
          );
        })}
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
