import type {
  ChatResponse,
  ChatSource,
  ChatStatus,
} from "@/lib/knowledge/types";

export const CHAT_STATUSES = [
  "answered",
  "not_found",
  "conflicting_information",
  "sensitive_information",
  "service_unavailable",
  "invalid_request",
] as const satisfies readonly ChatStatus[];

function isChatStatus(value: unknown): value is ChatStatus {
  return (
    typeof value === "string" &&
    (CHAT_STATUSES as readonly string[]).includes(value)
  );
}

function sourceFromUnknown(value: unknown): ChatSource | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  if (
    typeof source.id !== "string" ||
    typeof source.title !== "string" ||
    (source.sourceType !== "official_website" &&
      source.sourceType !== "manager_faq")
  ) {
    return undefined;
  }
  return {
    id: source.id,
    title: source.title,
    sourceType: source.sourceType,
    ...(typeof source.url === "string" ? { url: source.url } : {}),
  };
}

export function parseChatResponse(value: unknown): ChatResponse | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.answer !== "string" ||
    !isChatStatus(record.status) ||
    !Array.isArray(record.sources) ||
    typeof record.contactRecommended !== "boolean"
  ) {
    return undefined;
  }

  const sources = record.sources
    .map(sourceFromUnknown)
    .filter((source): source is ChatSource => source !== undefined);
  if (record.status === "answered" && sources.length === 0) return undefined;

  return {
    status: record.status,
    answer: record.answer,
    sources,
    contactRecommended: record.contactRecommended,
  };
}

export function responseBelongsInHistory(status: ChatStatus): boolean {
  return (
    status === "answered" ||
    status === "not_found" ||
    status === "conflicting_information"
  );
}
