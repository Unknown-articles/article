import { useState, useEffect, useRef } from 'react';

export default function Chat({ session }) {
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Connect to WebSocket server using token
    const ws = new WebSocket(`ws://localhost:3003/?token=${session.token}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === 'history') {
        setMessages(parsed.data);
      } else if (parsed.type === 'new_message') {
        setMessages((prev) => [...prev, parsed.data]);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error observed', error);
    };

    return () => {
      ws.close();
    };
  }, [session.token]);

  useEffect(() => {
    // Auto-scroll to latest message
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'chat_message', content: inputVal }));
      setInputVal('');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((msg) => {
          const isMe = msg.userId === session.user.id;
          return (
            <div key={msg.id} className={`message-wrapper ${isMe ? 'me' : 'them'}`}>
              <div className="message-content">
                <span className="message-username">{msg.username}</span>
                <p className="message-text">{msg.content}</p>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSend}>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Type a message..."
          autoFocus
        />
        <button type="submit" className="btn-primary send-btn">
          Send
        </button>
      </form>
    </div>
  );
}
