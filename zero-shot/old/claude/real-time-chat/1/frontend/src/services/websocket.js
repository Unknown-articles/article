const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
const RECONNECT_DELAY = 3000;

export class ChatWebSocket {
  #ws = null;
  #shouldReconnect = true;
  #reconnectTimer = null;
  #token;
  #handlers;

  constructor(token, handlers) {
    this.#token = token;
    this.#handlers = handlers;
    this.#connect();
  }

  #connect() {
    this.#ws = new WebSocket(`${WS_BASE}?token=${this.#token}`);

    this.#ws.onopen = () => {
      this.#handlers.onConnect?.();
    };

    this.#ws.onmessage = ({ data }) => {
      try {
        this.#handlers.onMessage?.(JSON.parse(data));
      } catch {
        console.error('[WS] Failed to parse message');
      }
    };

    this.#ws.onerror = (e) => {
      this.#handlers.onError?.(e);
    };

    this.#ws.onclose = (e) => {
      this.#handlers.onDisconnect?.(e);
      // Don't reconnect on auth failures
      if (this.#shouldReconnect && e.code !== 4001 && e.code !== 4002) {
        this.#reconnectTimer = setTimeout(() => this.#connect(), RECONNECT_DELAY);
      }
    };
  }

  send(content) {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify({ type: 'message', content }));
    }
  }

  disconnect() {
    this.#shouldReconnect = false;
    clearTimeout(this.#reconnectTimer);
    this.#ws?.close();
  }
}
