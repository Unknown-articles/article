import { useState } from "react";

export function MessageInput({ disabled, onSend }) {
  const [value, setValue] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (!value) {
      return;
    }

    const didSend = onSend(value);

    if (didSend) {
      setValue("");
    }
  }

  return (
    <form className="message-input-row" onSubmit={handleSubmit}>
      <input
        data-testid="input-message"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Type your message"
        disabled={disabled}
      />
      <button
        data-testid="btn-send"
        type="submit"
        disabled={disabled || value.length === 0}
      >
        Send
      </button>
    </form>
  );
}
