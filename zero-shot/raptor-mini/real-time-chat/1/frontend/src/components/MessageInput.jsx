import { useState } from "react";

function MessageInput({ onSendMessage }) {
  const [text, setText] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    onSendMessage(trimmed);
    setText("");
  };

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <input
        data-testid="input-message"
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Type a message..."
      />
      <button data-testid="btn-send" type="submit" disabled={text.trim().length === 0}>
        Send
      </button>
    </form>
  );
}

export default MessageInput;
