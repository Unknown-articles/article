import { useState, useEffect, useRef } from 'react';

function useWebSocket(token) {
  const [lastMessage, setLastMessage] = useState(null);
  const ws = useRef(null);

  useEffect(() => {
    if (token) {
      ws.current = new WebSocket(`ws://localhost:3001?token=${token}`);

      ws.current.onmessage = (event) => {
        setLastMessage(JSON.parse(event.data));
      };

      ws.current.onclose = () => {
        console.log('WebSocket closed');
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      return () => {
        ws.current.close();
      };
    }
  }, [token]);

  const sendMessage = (message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return { sendMessage, lastMessage };
}

export default useWebSocket;