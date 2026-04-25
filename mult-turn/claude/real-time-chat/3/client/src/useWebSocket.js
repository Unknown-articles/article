import { useEffect, useRef, useState } from 'react';

const WS_HOST = 'ws://localhost:3000';

export function useRealTimeConnection({ token, onHistory, onMessage, onError, onAuthFailure }) {
  const [isLive, setIsLive] = useState(false);
  const wsInstance = useRef(null);

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${WS_HOST}?token=${token}`);
    wsInstance.current = ws;

    ws.onopen = () => setIsLive(true);

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'history') onHistory(msg.messages);
      else if (msg.type === 'message') onMessage(msg);
      else if (msg.type === 'error') onError(msg.message);
    };

    ws.onclose = (event) => {
      setIsLive(false);
      wsInstance.current = null;
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

  function emit(payload) {
    if (wsInstance.current?.readyState === WebSocket.OPEN) {
      wsInstance.current.send(JSON.stringify(payload));
    }
  }

  return { isLive, emit };
}
