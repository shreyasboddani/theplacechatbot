"use client";

import { useState } from "react";

import { ThePlaceLogo } from "@/components/branding/BrandLogos";
import { ChatPanel } from "@/components/chatbot/ChatPanel";

interface ChatWidgetProps {
  variant?: "floating" | "embedded";
  initialOpen?: boolean;
  launcherVisible?: boolean;
  position?: "bottom-left" | "bottom-right";
  theme?: "light" | "dark" | "auto";
}

export function ChatWidget({
  variant = "floating",
  initialOpen = false,
  launcherVisible = true,
  position = "bottom-right",
  theme = "light",
}: ChatWidgetProps) {
  const [open, setOpen] = useState(initialOpen);
  const embedded = variant === "embedded";
  const showLauncher = !open && (launcherVisible || embedded);

  return (
    <div
      className={`chat-widget chat-widget-${variant} chat-widget-${position} chat-theme-${theme}`}
    >
      {open ? (
        <ChatPanel
          embedded={embedded}
          onMinimize={() => setOpen(false)}
          onClose={() => setOpen(false)}
        />
      ) : null}
      {showLauncher ? (
        <button
          type="button"
          className="chat-launcher"
          onClick={() => setOpen(true)}
          aria-label={open ? "Close The Place assistant" : "Open The Place assistant"}
          aria-expanded={open}
        >
          <span className="launcher-logo-wrap" aria-hidden="true">
            <ThePlaceLogo className="launcher-place-logo" decorative />
          </span>
          <span>Ask The Place</span>
        </button>
      ) : null}
    </div>
  );
}
