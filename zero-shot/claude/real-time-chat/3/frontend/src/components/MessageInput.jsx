import { useState } from 'react';

export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState('');

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={styles.wrapper}>
      <input
        data-testid="input-message"
        type="text"
        placeholder="Type a message…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        style={styles.input}
      />
      <button
        data-testid="btn-send"
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        style={{
          ...styles.btn,
          opacity: !text.trim() || disabled ? 0.5 : 1,
          cursor: !text.trim() || disabled ? 'not-allowed' : 'pointer',
        }}
      >
        Send
      </button>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderTop: '1px solid #e5e7eb',
    background: '#fff',
  },
  input: {
    flex: 1,
    padding: '0.6rem 0.9rem',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: '0.95rem',
    outline: 'none',
  },
  btn: {
    padding: '0.6rem 1.2rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: '0.9rem',
    fontWeight: 600,
  },
};
