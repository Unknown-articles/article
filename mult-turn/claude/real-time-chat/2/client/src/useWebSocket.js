import { useEffect, useRef, useState } from 'react';

const SOCKET_URL = 'ws://localhost:3000';

export function useSocketConnection({ token, onHistory, onMessage, onError, onAuthFailure }) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${SOCKET_URL}?token=${token}`);
    socketRef.current = ws;

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'history') onHistory(msg.messages);
      else if (msg.type === 'message') onMessage(msg);
      else if (msg.type === 'error') onError(msg.message);
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      socketRef.current = null;
      if (event.code === 4001 || event.code === 4002) onAuthFailure();
    };

    return () => {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [token]);

  function dispatch(payload) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  }

  return { isConnected, dispatch };
}
