import { AssistantMarkdown } from "@/components/chatbot/AssistantMarkdown";
import { ChatIcon } from "@/components/chatbot/Icons";
import { SourceCards } from "@/components/chatbot/SourceCards";
import type { ChatMessageItem } from "@/components/chatbot/types";
import { CHAT_UI_COPY, type ChatUiLanguage } from "@/lib/chat/language";

export function ChatMessage({
  message,
  language = "en",
}: {
  message: ChatMessageItem;
  language?: ChatUiLanguage;
}) {
  const isAssistant = message.role === "assistant";
  const copy = CHAT_UI_COPY[language];
  return (
    <article
      className={`chat-message ${isAssistant ? "chat-message-assistant" : "chat-message-user"} ${message.status === "invalid_request" || message.status === "service_unavailable" ? "chat-message-error" : ""}`}
      aria-label={isAssistant ? copy.assistantMessage : copy.userMessage}
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
          <SourceCards sources={message.sources} language={language} />
        ) : null}
      </div>
    </article>
  );
}
