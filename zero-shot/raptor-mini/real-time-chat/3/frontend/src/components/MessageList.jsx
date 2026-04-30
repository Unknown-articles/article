import { useEffect, useRef } from 'react'
import Message from './Message'

export default function MessageList({ messages, currentUserId }) {
  const listRef = useRef(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  if (!messages || messages.length === 0) {
    return (
      <div data-testid="message-list" ref={listRef} className="message-list empty-list">
        <div data-testid="message-empty" className="empty-state">
          No messages yet. Start the conversation.
        </div>
      </div>
    )
  }

  return (
    <div data-testid="message-list" ref={listRef} className="message-list">
      {messages.map((message) => (
        <Message key={message.id} message={message} currentUserId={currentUserId} />
      ))}
    </div>
  )
}
