import { useState } from 'react'

export default function MessageInput({ onSend }) {
  const [value, setValue] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <form className="message-input-form" onSubmit={handleSubmit}>
      <input
        data-testid="input-message"
        className="message-input"
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Type your message..."
      />
      <button
        data-testid="btn-send"
        className="primary-button"
        type="submit"
        disabled={!value.trim()}
      >
        Send
      </button>
    </form>
  )
}
