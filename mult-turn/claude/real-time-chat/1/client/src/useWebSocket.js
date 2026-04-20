import { useEffect, useRef, useState } from 'react';

const WS_BASE = 'ws://localhost:3000';

export function useWebSocket({ token, onHistory, onMessage, onError, onAuthFailure }) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${WS_BASE}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'history') onHistory(msg.messages);
      else if (msg.type === 'message') onMessage(msg);
      else if (msg.type === 'error') onError(msg.message);
    };

    ws.onclose = (event) => {
      setConnected(false);
      wsRef.current = null;
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

  function send(payload) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }

  return { connected, send };
}
