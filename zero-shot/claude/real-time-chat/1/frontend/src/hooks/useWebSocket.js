import { useEffect, useRef, useState, useCallback } from 'react';
import { ChatWebSocket } from '../services/websocket.js';

export function useWebSocket(token) {
  const [messages,  setMessages]  = useState([]);
  const [connected, setConnected] = useState(false);
  const [error,     setError]     = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const ws = new ChatWebSocket(token, {
      onConnect: () => {
        setConnected(true);
        setError(null);
      },
      onMessage: (data) => {
        if (data.type === 'history') {
          setMessages(data.messages);
        } else if (data.type === 'message') {
          setMessages((prev) => [...prev, data]);
        } else if (data.type === 'error') {
          setError(data.message);
        }
      },
      onDisconnect: () => setConnected(false),
      onError: ()    => setError('WebSocket connection error. Retrying…'),
    });

    wsRef.current = ws;
    return () => ws.disconnect();
  }, [token]);

  const sendMessage = useCallback((content) => {
    wsRef.current?.send(content);
  }, []);

  return { messages, connected, error, sendMessage };
}
