import type { ChatRequest } from "@/lib/security/input-validation";
import {
  MAX_HISTORY_CONTENT_LENGTH,
  MAX_MESSAGE_LENGTH,
  RUNTIME_HISTORY_ITEMS,
} from "@/lib/chat/limits";

export interface ChatHistoryCandidate {
  role?: unknown;
  content?: unknown;
  includeInHistory?: boolean;
}

export type ChatRequestBuildResult =
  | { success: true; payload: ChatRequest }
  | {
      success: false;
      reason: "empty_message" | "invalid_message" | "message_too_long";
    };

export function captureMessageForSubmit(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const messageToSend = value.trim();
  return messageToSend || undefined;
}

function normalizeHistoryItem(
  item: ChatHistoryCandidate,
): ChatRequest["history"][number] | undefined {
  if (
    item.includeInHistory !== true ||
    (item.role !== "user" && item.role !== "assistant") ||
    typeof item.content !== "string"
  ) {
    return undefined;
  }

  const content = item.content.trim();
  if (!content) return undefined;

  return {
    role: item.role,
    content: content.slice(0, MAX_HISTORY_CONTENT_LENGTH),
  };
}

export function buildChatRequest<T extends ChatHistoryCandidate>(
  message: unknown,
  messages: readonly T[],
): ChatRequestBuildResult {
  const messageToSend = captureMessageForSubmit(message);
  if (!messageToSend) {
    return {
      success: false,
      reason: typeof message === "string" ? "empty_message" : "invalid_message",
    };
  }
  if (messageToSend.length > MAX_MESSAGE_LENGTH) {
    return { success: false, reason: "message_too_long" };
  }

  const history = messages
    .map(normalizeHistoryItem)
    .filter(
      (item): item is ChatRequest["history"][number] => item !== undefined,
    )
    .slice(-RUNTIME_HISTORY_ITEMS);

  return {
    success: true,
    payload: {
      message: messageToSend,
      history,
    },
  };
}
