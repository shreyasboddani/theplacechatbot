"use client";

import { useEffect, useRef, useState } from "react";

import {
  LearnAILogo,
  ThePlaceLogo,
} from "@/components/branding/BrandLogos";
import { ChatInput } from "@/components/chatbot/ChatInput";
import { ChatMessage } from "@/components/chatbot/ChatMessage";
import {
  ChatIcon,
  CloseIcon,
  MinimizeIcon,
  RestartIcon,
} from "@/components/chatbot/Icons";
import { PrivacyNotice } from "@/components/chatbot/PrivacyNotice";
import { QuickActions } from "@/components/chatbot/QuickActions";
import type { ChatMessageItem } from "@/components/chatbot/types";
import { CLIENT_REQUEST_TIMEOUT_MS } from "@/lib/chat/limits";
import { buildChatRequest } from "@/lib/chat/request";
import {
  parseChatResponse,
  responseBelongsInHistory,
} from "@/lib/chat/response";

const WELCOME_MESSAGE: ChatMessageItem = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I can help you find approved information from The Place about services, donations, volunteering, and more. What would you like help with?",
  includeInHistory: false,
};

interface ChatPanelProps {
  embedded?: boolean;
  active?: boolean;
  onMinimize: () => void;
  onClose: () => void;
}

export function ChatPanel({
  embedded,
  active = true,
  onMinimize,
  onClose,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([WELCOME_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const activeControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  useEffect(() => {
    if (active) panelRef.current?.focus();
  }, [active]);

  useEffect(
    () => () => {
      activeControllerRef.current?.abort();
    },
    [],
  );

  async function sendMessage(message: unknown) {
    if (pendingRef.current) return;
    const request = buildChatRequest(message, messages);
    if (!request.success) {
      if (request.reason === "empty_message") return;
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            request.reason === "message_too_long"
              ? "That message is too long to send. Please shorten it and try again."
              : "The chat control could not read that message. Please type your question in the message box and try again.",
          includeInHistory: false,
          status: "invalid_request",
        },
      ]);
      return;
    }

    pendingRef.current = true;
    const userMessage: ChatMessageItem = {
      id: crypto.randomUUID(),
      role: "user",
      content: request.payload.message,
      includeInHistory: true,
    };
    setMessages((current) => [...current, userMessage]);
    setLoading(true);

    const controller = new AbortController();
    activeControllerRef.current = controller;
    const timeout = window.setTimeout(
      () => controller.abort(),
      CLIENT_REQUEST_TIMEOUT_MS,
    );
    try {
      const httpResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.payload),
        signal: controller.signal,
      });
      const response = parseChatResponse(await httpResponse.json());
      if (!response) throw new Error("Invalid assistant response");
      const includeInHistory = responseBelongsInHistory(response.status);
      setMessages((current) => [
        ...current.map((item) =>
          item.id === userMessage.id && !includeInHistory
            ? {
                ...item,
                content:
                  response.status === "sensitive_information"
                    ? "Sensitive information was not sent."
                    : item.content,
                includeInHistory: false,
              }
            : item,
        ),
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.answer,
          includeInHistory,
          sources: response.sources,
          status: response.status,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current.map((item) =>
          item.id === userMessage.id
            ? { ...item, includeInHistory: false }
            : item,
        ),
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "The information assistant is temporarily unavailable. Please try again in a moment. If you still need help, contact The Place at 770-887-1098 or use the contact page.",
          sources: [
            {
              id: "contact-the-place",
              title: "Contact The Place",
              url: "https://www.theplacega.org/contact-us",
              sourceType: "official_website",
            },
          ],
          includeInHistory: false,
          status: "service_unavailable",
        },
      ]);
    } finally {
      window.clearTimeout(timeout);
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
      pendingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <section
      ref={panelRef}
      className={`chat-panel ${embedded ? "chat-panel-embedded" : ""}`}
      role="dialog"
      aria-modal={!embedded}
      aria-labelledby="chatbot-title"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") onMinimize();
      }}
    >
      <header className="chat-panel-header">
        <div className="chat-brand-mark">
          <ThePlaceLogo className="chat-place-logo" />
        </div>
        <div className="chat-title-block">
          <h2 id="chatbot-title" aria-label="The Place Assistant">Assistant</h2>
          <p><span aria-hidden="true" /> Official information</p>
        </div>
        <div className="chat-header-actions">
          <button
            type="button"
            onClick={() => setMessages([WELCOME_MESSAGE])}
            disabled={loading}
            aria-label="Restart conversation"
            title="Restart conversation"
          >
            <RestartIcon />
          </button>
          <button
            type="button"
            onClick={onMinimize}
            aria-label="Minimize chat"
            title="Minimize chat"
          >
            <MinimizeIcon />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            title="Close chat"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="prototype-strip">
        <LearnAILogo className="prototype-logo" decorative />
        <span>Prototype technology by <strong>LearnAI</strong></span>
      </div>

      <div
        className="chat-scroll"
        ref={scrollerRef}
        aria-live="polite"
        aria-busy={loading}
      >
        <div className="chat-day-label">Today</div>
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {messages.length === 1 ? (
          <QuickActions disabled={loading} onSelect={sendMessage} />
        ) : null}
        {loading ? (
          <div className="typing-row" aria-label="Assistant is looking through approved sources">
            <div className="assistant-avatar" aria-hidden="true">
              <ChatIcon size={17} />
            </div>
            <div className="typing-bubble" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}
      </div>

      <footer className="chat-composer">
        <PrivacyNotice />
        <ChatInput disabled={loading} onSend={sendMessage} />
        <p className="chat-grounding-note">Answers require a confirmed official source.</p>
      </footer>
    </section>
  );
}
