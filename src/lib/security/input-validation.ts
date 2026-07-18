import { z } from "zod";

import {
  MAX_HISTORY_CONTENT_LENGTH,
  MAX_HISTORY_ITEMS,
  MAX_MESSAGE_LENGTH,
  RUNTIME_HISTORY_ITEMS,
} from "@/lib/chat/limits";

export {
  MAX_HISTORY_CONTENT_LENGTH,
  MAX_HISTORY_ITEMS,
  MAX_MESSAGE_LENGTH,
  MAX_REQUEST_BYTES,
  RUNTIME_HISTORY_ITEMS,
} from "@/lib/chat/limits";

export const historyItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(MAX_HISTORY_CONTENT_LENGTH),
}).strip();

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  history: z.array(historyItemSchema).max(MAX_HISTORY_ITEMS).default([]),
}).strip();

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export interface ValidationIssueSummary {
  path: string;
  code: string;
  expected?: string;
}

function expectedValue(issue: z.core.$ZodIssue): string | undefined {
  const details = issue as z.core.$ZodIssue & Record<string, unknown>;
  if (typeof details.expected === "string") return details.expected;
  if (typeof details.maximum === "number") {
    return `at most ${details.maximum} characters or items`;
  }
  if (typeof details.minimum === "number") {
    return `at least ${details.minimum} character or item`;
  }
  if (Array.isArray(details.values)) return details.values.join(" | ");
  return undefined;
}

function summarizeIssues(error: z.ZodError): ValidationIssueSummary[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "request",
    code: issue.code,
    ...(expectedValue(issue) ? { expected: expectedValue(issue) } : {}),
  }));
}

function validationReason(issues: ValidationIssueSummary[]): string {
  if (issues.some((issue) => issue.path === "message")) {
    return `Please enter a non-empty message no longer than ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`;
  }
  if (issues.some((issue) => issue.path.startsWith("history"))) {
    return "The browser could not validate the recent conversation. Please restart the chat and try again.";
  }
  return "The browser sent a malformed chat request. Please refresh the page and try again.";
}

export function validateChatRequest(value: unknown):
  | { success: true; data: ChatRequest }
  | {
      success: false;
      reason: string;
      issues: ValidationIssueSummary[];
    } {
  const result = chatRequestSchema.safeParse(value);
  if (!result.success) {
    const issues = summarizeIssues(result.error);
    return {
      success: false,
      reason: validationReason(issues),
      issues,
    };
  }

  return {
    success: true,
    data: {
      ...result.data,
      history: result.data.history.slice(-RUNTIME_HISTORY_ITEMS),
    },
  };
}
