import type { ChatSource, ChatStatus } from "@/lib/knowledge/types";

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  includeInHistory: boolean;
  sources?: ChatSource[];
  status?: ChatStatus;
}
