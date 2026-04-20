import { useEffect, useRef, useCallback, useState } from 'react';

export function useWebSocket(url, onMessage) {
  const ws = useRef(null);
  const onMessageRef = useRef(onMessage);
  const [connected, setConnected] = useState(false);

  // Keep ref current so the stable onmessage handler always calls the latest version
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!url) return;
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen  = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);
    socket.onmessage = e => {
      try { onMessageRef.current(JSON.parse(e.data)); }
      catch { onMessageRef.current(e.data); }
    };

    return () => socket.close();
  }, [url]);

  const send = useCallback((data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }, []);

  return { connected, send };
}
