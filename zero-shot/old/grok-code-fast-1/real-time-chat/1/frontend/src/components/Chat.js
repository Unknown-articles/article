import React, { useState, useEffect, useRef } from 'react';
import useWebSocket from '../hooks/useWebSocket';

function Chat({ token, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const { sendMessage, lastMessage } = useWebSocket(token);

  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'messages') {
        setMessages(lastMessage.data);
      } else if (lastMessage.type === 'message') {
        setMessages(prev => [...prev, lastMessage.data]);
      }
    }
  }, [lastMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ type: 'message', content: input });
      setInput('');
    }
  };

  return (
    <div className="chat">
      <button onClick={onLogout}>Logout</button>
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className="message">
            <strong>{msg.username}:</strong> {msg.content}
            <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          required
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

export default Chat;