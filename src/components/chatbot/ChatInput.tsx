import { FormEvent, useEffect, useRef, useState } from "react";

import { SendIcon } from "@/components/chatbot/Icons";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat/limits";
import { captureMessageForSubmit } from "@/lib/chat/request";

interface ChatInputProps {
  disabled: boolean;
  onSend: (message: string) => void;
}

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.max(32, Math.min(input.scrollHeight, 90))}px`;
  }, [message]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const messageToSend = captureMessageForSubmit(message);
    if (!messageToSend || disabled) return;
    onSend(messageToSend);
    setMessage("");
    inputRef.current?.focus();
  }

  return (
    <form className="chat-input-form" onSubmit={submit}>
      <label htmlFor="the-place-chat-input" className="sr-only">
        Ask The Place information assistant
      </label>
      <textarea
        ref={inputRef}
        id="the-place-chat-input"
        value={message}
        onChange={(event) =>
          setMessage(event.target.value.slice(0, MAX_MESSAGE_LENGTH))
        }
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        rows={1}
        maxLength={MAX_MESSAGE_LENGTH}
        placeholder="Ask about services, donations, or volunteering..."
        disabled={disabled}
      />
      <button
        type="submit"
        className="chat-send-button"
        disabled={disabled || !message.trim()}
        aria-label="Send message"
      >
        <SendIcon />
      </button>
    </form>
  );
}
