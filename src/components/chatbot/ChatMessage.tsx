import { AssistantMarkdown } from "@/components/chatbot/AssistantMarkdown";
import { ChatIcon } from "@/components/chatbot/Icons";
import { SourceCards } from "@/components/chatbot/SourceCards";
import type { ChatMessageItem } from "@/components/chatbot/types";

export function ChatMessage({ message }: { message: ChatMessageItem }) {
  const isAssistant = message.role === "assistant";
  return (
    <article
      className={`chat-message ${isAssistant ? "chat-message-assistant" : "chat-message-user"} ${message.status === "invalid_request" || message.status === "service_unavailable" ? "chat-message-error" : ""}`}
      aria-label={isAssistant ? "Assistant message" : "Your message"}
    >
      {isAssistant ? (
        <div className="assistant-avatar" aria-hidden="true">
          <ChatIcon size={17} />
        </div>
      ) : null}
      <div className="message-stack">
        <div className="message-bubble">
          {isAssistant ? (
            <AssistantMarkdown content={message.content} />
          ) : (
            <p>{message.content}</p>
          )}
        </div>
        {isAssistant && message.sources ? (
          <SourceCards sources={message.sources} />
        ) : null}
      </div>
    </article>
  );
}
