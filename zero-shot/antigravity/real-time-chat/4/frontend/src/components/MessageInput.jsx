import React, { useState } from 'react';

export function MessageInput({ onSend }) {
    const [content, setContent] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (content.trim()) {
            onSend(content.trim());
            setContent('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <form className="message-input-form" onSubmit={handleSubmit}>
            <input
                type="text"
                data-testid="input-message"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="message-input"
            />
            <button
                type="submit"
                data-testid="btn-send"
                disabled={content.length === 0}
                className="send-btn"
            >
                Send
            </button>
        </form>
    );
}
