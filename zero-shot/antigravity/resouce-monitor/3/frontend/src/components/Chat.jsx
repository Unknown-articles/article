import React, { useState, useEffect, useRef } from 'react';
import { MessageList } from './MessageList.jsx';
import { MessageInput } from './MessageInput.jsx';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

export function Chat({ session, onLogout }) {
    const { token, user } = session;
    const [messages, setMessages] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);
    const wsRef = useRef(null);

    useEffect(() => {
        const ws = new WebSocket(`${WS_URL}?token=${token}`);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            setError(null);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'history') {
                    setMessages(data.messages);
                } else if (data.type === 'message') {
                    setMessages(prev => [...prev, data]);
                } else if (data.type === 'error') {
                    setError(data.message);
                }
            } catch (err) {
                console.error('Error parsing message:', err);
            }
        };

        ws.onclose = (event) => {
            setIsConnected(false);
            if (event.code === 4001 || event.code === 4002) {
                onLogout(); // Invalid token, force logout
            } else {
                setError('Connection lost');
            }
        };

        ws.onerror = () => {
            setError('WebSocket error');
            setIsConnected(false);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
        };
    }, [token, onLogout]);

    const handleSendMessage = (content) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'message', content }));
        }
    };

    return (
        <div data-testid="chat-container" className="chat-container glass-panel">
            <header className="chat-header">
                <div className="user-info">
                    <div 
                        data-testid="connection-status" 
                        data-connected={isConnected}
                        className={`status-indicator ${isConnected ? 'online' : 'offline'}`}
                    />
                    <span data-testid="current-username" className="current-username">
                        {user.username}
                    </span>
                </div>
                <button data-testid="btn-logout" onClick={onLogout} className="logout-btn">
                    Logout
                </button>
            </header>

            {error && (
                <div data-testid="connection-error" className="error-banner">
                    {error}
                </div>
            )}

            <main className="chat-main">
                <MessageList messages={messages} currentUserId={user.userId} />
            </main>

            <footer className="chat-footer">
                <MessageInput onSend={handleSendMessage} />
            </footer>
        </div>
    );
}
