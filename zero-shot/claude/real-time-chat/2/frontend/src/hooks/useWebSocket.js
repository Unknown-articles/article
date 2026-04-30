import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = 'ws://localhost:5000';

export function useWebSocket(token) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'history') {
        setMessages(data.messages);
      } else if (data.type === 'message') {
        const { type: _, ...msg } = data;
        setMessages((prev) => [...prev, msg]);
      } else if (data.type === 'error') {
        setError(data.message);
      }
    };

    ws.onclose = (e) => {
      setConnected(false);
      if (e.code === 4001 || e.code === 4002) {
        setError('Authentication failed. Please log in again.');
      }
    };

    ws.onerror = () => {
      setError('Connection error');
    };

    return () => {
      ws.close();
    };
  }, [token]);

  const sendMessage = useCallback((content) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', content }));
    }
  }, []);

  return { messages, connected, error, sendMessage };
}
