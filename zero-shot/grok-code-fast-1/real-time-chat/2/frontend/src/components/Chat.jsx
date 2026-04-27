import { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import useWebSocket from '../hooks/useWebSocket';

function Chat({ user, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const messageListRef = useRef(null);

  const { sendMessage } = useWebSocket({
    token: localStorage.getItem('chat_token'),
    onMessage: (data) => {
      if (data.type === 'history') {
        setMessages(data.messages);
      } else if (data.type === 'message') {
        setMessages(prev => [...prev, data]);
      } else if (data.type === 'error') {
        setError(data.message);
      }
    },
    onConnect: () => setConnected(true),
    onDisconnect: () => setConnected(false),
    onError: (err) => setError(err),
  });

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (content) => {
    sendMessage({ type: 'message', content });
  };

  return (
    <div data-testid="chat-container" className="chat-container">
      <div className="header">
        <div data-testid="connection-status" data-connected={connected.toString()}>
          {connected ? 'Online' : 'Offline'}
        </div>
        <div data-testid="current-username">{user.username}</div>
        <button data-testid="btn-logout" onClick={onLogout}>Logout</button>
      </div>
      {error && <div data-testid="connection-error" className="error">{error}</div>}
      <MessageList messages={messages} currentUserId={user.userId} ref={messageListRef} />
      <MessageInput onSend={handleSendMessage} />
    </div>
  );
}

export default Chat;