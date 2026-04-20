import { useEffect, useRef, useCallback, useState } from 'react';

export function useWebSocket(url, onMessage) {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!url) return;
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);
    socket.onmessage = e => {
      try { onMessage(JSON.parse(e.data)); }
      catch { onMessage(e.data); }
    };

    return () => socket.close();
  }, [url, onMessage]);
  }, [url]);

  const send = useCallback((data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }, []);

  return { connected, send };
}
