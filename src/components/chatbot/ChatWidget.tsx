"use client";

import { useEffect, useRef, useState } from "react";

import { ThePlaceLogo } from "@/components/branding/BrandLogos";
import { ChatPanel } from "@/components/chatbot/ChatPanel";
import { ChatIcon, CloseIcon } from "@/components/chatbot/Icons";

export const CHAT_NUDGE_DELAY_MS = 2200;
export const CHAT_NUDGE_VISIBLE_MS = 9000;
export const CHAT_NUDGE_SESSION_KEY = "the-place-chatbot-nudge-seen";

interface ChatWidgetProps {
  variant?: "floating" | "embedded";
  initialOpen?: boolean;
  launcherVisible?: boolean;
  position?: "bottom-left" | "bottom-right";
  promptEnabled?: boolean;
  theme?: "light" | "dark" | "auto";
}

export function ChatWidget({
  variant = "floating",
  initialOpen = false,
  launcherVisible = true,
  position = "bottom-right",
  promptEnabled = true,
  theme = "light",
}: ChatWidgetProps) {
  const [open, setOpen] = useState(initialOpen);
  const [panelMounted, setPanelMounted] = useState(initialOpen);
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const nudgeAttemptedRef = useRef(initialOpen);
  const embedded = variant === "embedded";
  const showLauncher = !open && (launcherVisible || embedded);

  function markNudgeSeen() {
    nudgeAttemptedRef.current = true;
    try {
      window.sessionStorage.setItem(CHAT_NUDGE_SESSION_KEY, "true");
    } catch {
      // Storage may be unavailable in a privacy-restricted host page.
    }
  }

  useEffect(() => {
    if (
      embedded ||
      !launcherVisible ||
      !promptEnabled ||
      open ||
      nudgeAttemptedRef.current
    ) {
      return;
    }
    try {
      if (window.sessionStorage.getItem(CHAT_NUDGE_SESSION_KEY) === "true") {
        nudgeAttemptedRef.current = true;
        return;
      }
    } catch {
      // Continue with an in-memory once-per-mount guard when storage is blocked.
    }

    nudgeAttemptedRef.current = true;
    let hideTimer: number | undefined;
    const showTimer = window.setTimeout(() => {
      setNudgeVisible(true);
      try {
        window.sessionStorage.setItem(CHAT_NUDGE_SESSION_KEY, "true");
      } catch {
        // The in-memory guard still prevents repetition during this mount.
      }
      hideTimer = window.setTimeout(
        () => setNudgeVisible(false),
        CHAT_NUDGE_VISIBLE_MS,
      );
    }, CHAT_NUDGE_DELAY_MS);

    return () => {
      window.clearTimeout(showTimer);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    };
  }, [embedded, launcherVisible, open, promptEnabled]);

  function openPanel() {
    markNudgeSeen();
    setNudgeVisible(false);
    setPanelMounted(true);
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
    setPanelMounted(false);
  }

  return (
    <div
      className={`chat-widget chat-widget-${variant} chat-widget-${position} chat-theme-${theme}`}
    >
      {panelMounted ? (
        <div hidden={!open}>
          <ChatPanel
            embedded={embedded}
            active={open}
            position={position}
            onMinimize={() => setOpen(false)}
            onClose={closePanel}
          />
        </div>
      ) : null}
      {showLauncher ? (
        <>
          {nudgeVisible ? (
            <div className="chat-launcher-nudge" role="status">
              <button
                type="button"
                className="chat-launcher-nudge-action"
                onClick={openPanel}
                aria-label="Need help? Open The Place chatbot"
              >
                <span className="chat-launcher-nudge-icon" aria-hidden="true">
                  <ChatIcon size={16} />
                </span>
                <span>
                  <strong>Need help?</strong>
                  <small>Ask The Place chatbot</small>
                </span>
              </button>
              <button
                type="button"
                className="chat-launcher-nudge-close"
                onClick={() => {
                  markNudgeSeen();
                  setNudgeVisible(false);
                }}
                aria-label="Dismiss chat suggestion"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="chat-launcher"
            onClick={openPanel}
            aria-label="Open The Place assistant"
            aria-expanded={open}
          >
            <span className="launcher-logo-wrap" aria-hidden="true">
              <ThePlaceLogo className="launcher-place-logo" decorative />
            </span>
            <span>Ask The Place</span>
          </button>
        </>
      ) : null}
    </div>
  );
}
