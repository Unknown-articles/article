import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = 'ws://localhost:5000';

export default function useWebSocket(token) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const wsRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
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
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      if (event.code === 4001 || event.code === 4002) {
        setError('Authentication failed. Please log in again.');
      } else if (!event.wasClean) {
        setError('Connection lost. Trying to reconnect…');
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection error.');
    };

    return () => {
      ws.close();
    };
  }, [token]);

  const sendMessage = useCallback((content) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message', content }));
    }
  }, []);

  return { messages, connected, error, sendMessage };
}
