"use client";

import { useEffect, useRef, useState } from "react";

import {
  LearnAILogo,
  ThePlaceLogo,
} from "@/components/branding/BrandLogos";
import { ChatInput } from "@/components/chatbot/ChatInput";
import { LanguageSelector } from "@/components/chatbot/LanguageSelector";
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
  CHAT_UI_COPY,
  chatUiLanguage,
  type ChatLanguagePreference,
} from "@/lib/chat/language";
import {
  parseChatResponse,
  responseBelongsInHistory,
} from "@/lib/chat/response";

function welcomeMessage(language: ChatLanguagePreference): ChatMessageItem {
  return {
    id: "welcome",
    role: "assistant",
    content: CHAT_UI_COPY[chatUiLanguage(language)].welcome,
    includeInHistory: false,
  };
}

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
  const [language, setLanguage] = useState<ChatLanguagePreference>("auto");
  const uiLanguage = chatUiLanguage(language);
  const copy = CHAT_UI_COPY[uiLanguage];
  const [messages, setMessages] = useState<ChatMessageItem[]>(() => [
    welcomeMessage("auto"),
  ]);
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
    const request = buildChatRequest(message, messages, language);
    if (!request.success) {
      if (request.reason === "empty_message") return;
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            request.reason === "message_too_long"
              ? copy.invalidLong
              : copy.invalidMessage,
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
        headers: {
          "Content-Type": "application/json",
          "X-Chat-Language": language,
        },
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
                    ? copy.sensitiveReplacement
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
          content: copy.unavailable,
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

  function changeLanguage(nextLanguage: ChatLanguagePreference) {
    setLanguage(nextLanguage);
    setMessages((current) =>
      current.length === 1 && current[0]?.id === "welcome"
        ? [welcomeMessage(nextLanguage)]
        : current,
    );
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
          <h2 id="chatbot-title" aria-label={`The Place ${copy.assistant}`}>
            {copy.assistant}
          </h2>
          <p><span aria-hidden="true" /> {copy.officialInformation}</p>
        </div>
        <div className="chat-header-actions">
          <button
            type="button"
            onClick={() => setMessages([welcomeMessage(language)])}
            disabled={loading}
            aria-label={copy.restart}
            title={copy.restart}
          >
            <RestartIcon />
          </button>
          <button
            type="button"
            onClick={onMinimize}
            aria-label={copy.minimize}
            title={copy.minimize}
          >
            <MinimizeIcon />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            title={copy.close}
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="prototype-strip">
        <LearnAILogo className="prototype-logo" decorative />
        <span>{copy.prototypeBy} <strong>LearnAI</strong></span>
      </div>

      <div className="chat-language-bar">
        <LanguageSelector
          value={language}
          uiLanguage={uiLanguage}
          disabled={loading}
          onChange={changeLanguage}
        />
      </div>

      <div
        className="chat-scroll"
        ref={scrollerRef}
        aria-live="polite"
        aria-busy={loading}
      >
        <div className="chat-day-label">{copy.today}</div>
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            language={uiLanguage}
          />
        ))}
        {messages.length === 1 ? (
          <QuickActions
            disabled={loading}
            onSelect={sendMessage}
            language={uiLanguage}
          />
        ) : null}
        {loading ? (
          <div className="typing-row" aria-label={copy.typing}>
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
        <PrivacyNotice language={uiLanguage} />
        <ChatInput
          disabled={loading}
          onSend={sendMessage}
          language={uiLanguage}
        />
        <p className="chat-grounding-note">{copy.groundingNote}</p>
      </footer>
    </section>
  );
}
