import React from 'react';

export function Message({ msg, isOwn }) {
    const timeString = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
    return (
        <div 
            data-testid="message-item" 
            data-own={isOwn} 
            data-message-id={msg.id}
            className={`message ${isOwn ? 'message-own' : 'message-other'}`}
        >
            <div className="message-header">
                <span data-testid="message-username" className="message-username">
                    {isOwn ? 'You' : msg.username}
                </span>
                <span data-testid="message-timestamp" className="message-timestamp">
                    {timeString}
                </span>
            </div>
            <div data-testid="message-content" className="message-content">
                {msg.content}
            </div>
        </div>
    );
}
