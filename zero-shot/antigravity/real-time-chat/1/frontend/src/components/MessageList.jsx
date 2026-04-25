import React, { useRef, useEffect } from 'react';
import { Message } from './Message.jsx';

export function MessageList({ messages, currentUserId }) {
    const listRef = useRef(null);

    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div data-testid="message-list" className="message-list" ref={listRef}>
            {messages.length === 0 ? (
                <div data-testid="message-empty" className="message-empty">
                    No messages yet. Start the conversation!
                </div>
            ) : (
                messages.map(msg => (
                    <Message 
                        key={msg.id} 
                        msg={msg} 
                        isOwn={msg.userId === currentUserId} 
                    />
                ))
            )}
        </div>
    );
}
