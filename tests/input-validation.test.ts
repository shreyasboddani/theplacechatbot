import { describe, expect, it } from "vitest";

import {
  MAX_HISTORY_CONTENT_LENGTH,
  MAX_MESSAGE_LENGTH,
  validateChatRequest,
} from "@/lib/security/input-validation";

describe("chat request validation", () => {
  it("accepts a normal supported question", () => {
    const result = validateChatRequest({
      message: "Where can I donate food?",
      history: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty message", () => {
    expect(validateChatRequest({ message: "   ", history: [] }).success).toBe(
      false,
    );
  });

  it("rejects an excessively long message", () => {
    expect(
      validateChatRequest({
        message: "x".repeat(MAX_MESSAGE_LENGTH + 1),
        history: [],
      }).success,
    ).toBe(false);
  });

  it("trims accepted history to the most recent six messages", () => {
    const result = validateChatRequest({
      message: "How do I volunteer?",
      history: Array.from({ length: 8 }, (_, index) => ({
        role: index % 2 === 0 ? "user" : "assistant",
        content: `message ${index}`,
      })),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.history).toHaveLength(6);
      expect(result.data.history[0]?.content).toBe("message 2");
    }
  });

  it("rejects unbounded history", () => {
    const result = validateChatRequest({
      message: "How do I volunteer?",
      history: Array.from({ length: 21 }, () => ({
        role: "user",
        content: "hello",
      })),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a backend-sized assistant answer in follow-up history", () => {
    const result = validateChatRequest({
      message: "Can you explain that more simply?",
      history: [
        {
          role: "assistant",
          content: "A".repeat(MAX_HISTORY_CONTENT_LENGTH),
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("strips harmless unknown fields instead of letting them influence prompts", () => {
    const result = validateChatRequest({
      message: "Where can I donate food?",
      pending: true,
      history: [
        {
          id: "ui-id",
          role: "user",
          content: "I want to donate.",
          sources: ["ui-only"],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        message: "Where can I donate food?",
        history: [{ role: "user", content: "I want to donate." }],
      });
    }
  });
});
