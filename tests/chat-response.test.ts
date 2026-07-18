import { describe, expect, it } from "vitest";

import { CHAT_STATUSES, parseChatResponse } from "@/lib/chat/response";

describe("client API response handling", () => {
  it.each(CHAT_STATUSES)("accepts the %s API status", (status) => {
    const sources =
      status === "answered"
        ? [
            {
              id: "staff-answer",
              title: "Information provided by The Place staff",
              sourceType: "manager_faq",
            },
          ]
        : [];
    expect(
      parseChatResponse({
        status,
        answer: `Response for ${status}`,
        sources,
        contactRecommended: status !== "answered",
      })?.status,
    ).toBe(status);
  });

  it("rejects an answered response without a valid mapped source", () => {
    expect(
      parseChatResponse({
        status: "answered",
        answer: "Unsupported answer",
        sources: [],
        contactRecommended: false,
      }),
    ).toBeUndefined();
  });

  it("rejects malformed response fields", () => {
    expect(
      parseChatResponse({
        status: "unknown",
        answer: "No",
        sources: [],
        contactRecommended: false,
      }),
    ).toBeUndefined();
  });
});
