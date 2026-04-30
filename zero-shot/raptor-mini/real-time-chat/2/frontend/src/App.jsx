import { useEffect, useMemo, useRef, useState } from 'react';
import AuthForm from './components/AuthForm.jsx';
import Chat from './components/Chat.jsx';

const STORAGE_TOKEN_KEY = 'chat_token';
const STORAGE_USER_KEY = 'chat_user';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function parseStoredUser() {
  const raw = localStorage.getItem(STORAGE_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function App() {
  const [session, setSession] = useState(() => {
    const token = localStorage.getItem(STORAGE_TOKEN_KEY);
    const user = parseStoredUser();
    return token && user ? { token, ...user } : null;
  });
  const [messages, setMessages] = useState([]);
  const [connectionError, setConnectionError] = useState('');
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!session) {
      if (wsRef.current) {
        wsRef.current.close();
      }
      setConnected(false);
      return;
    }

    const wsEndpoint = `${API_URL.replace(/^http/, 'ws')}/?token=${encodeURIComponent(session.token)}`;
    const socket = new WebSocket(wsEndpoint);
    wsRef.current = socket;

    socket.addEventListener('open', () => {
      setConnected(true);
      setConnectionError('');
    });

    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'history') {
          setMessages(data.messages || []);
          return;
        }
        if (data.type === 'message') {
          setMessages((prev) => [...prev, data]);
          return;
        }
        if (data.type === 'error') {
          setConnectionError(data.message || 'WebSocket error');
          return;
        }
      } catch {
        setConnectionError('Unable to parse server message');
      }
    });

    socket.addEventListener('close', (event) => {
      setConnected(false);
      if (event.code === 4001 || event.code === 4002) {
        setConnectionError('Authentication error. Please log in again.');
        handleLogout();
      } else if (event.code !== 1000) {
        setConnectionError('Connection closed unexpectedly.');
      }
    });

    socket.addEventListener('error', () => {
      setConnectionError('Unable to connect to chat server.');
      setConnected(false);
    });

    return () => {
      socket.close();
    };
  }, [session]);

  const handleAuthSuccess = ({ token, userId, username }) => {
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify({ userId, username }));
    setSession({ token, userId, username });
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    setSession(null);
    setMessages([]);
    setConnectionError('');
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const sendMessage = (content) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setConnectionError('Not connected.');
      return;
    }
    wsRef.current.send(JSON.stringify({ type: 'message', content }));
  };

  const contextValue = useMemo(() => ({ currentUserId: session?.userId, username: session?.username }), [session]);

  if (!session) {
    return <AuthForm onAuthSuccess={handleAuthSuccess} apiUrl={API_URL} />;
  }

  return (
    <Chat
      currentUsername={session.username}
      connectionError={connectionError}
      connected={connected}
      messages={messages}
      onSend={sendMessage}
      onLogout={handleLogout}
      currentUserId={contextValue.currentUserId}
    />
  );
}

export default App;
