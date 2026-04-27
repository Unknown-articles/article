import { useEffect, useRef } from 'react';

function useWebSocket({ token, onMessage, onConnect, onDisconnect, onError }) {
  const wsRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`ws://localhost:3000?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      onConnect && onConnect();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (err) {
        onError && onError('Invalid message received');
      }
    };

    ws.onclose = () => {
      onDisconnect && onDisconnect();
    };

    ws.onerror = (error) => {
      onError && onError('WebSocket error');
    };

    return () => {
      ws.close();
    };
  }, [token, onMessage, onConnect, onDisconnect, onError]);

  const sendMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  return { sendMessage };
}

export default useWebSocket;