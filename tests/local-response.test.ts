import { describe, expect, it } from "vitest";

import { getLocalConversationalResponse } from "@/lib/chat/local-response";

describe("local conversational responses", () => {
  it.each(["hello", "Hi!", "good morning", "HEY THERE?"])(
    "recognizes a standalone greeting: %j",
    (message) => {
      const response = getLocalConversationalResponse(message);

      expect(response?.status).toBe("answered");
      expect(response?.contactRecommended).toBe(false);
      expect(response?.sources[0]?.url).toBe("https://www.theplacega.org/");
    },
  );

  it.each([
    "what questions can You answer",
    "What can you help me with?",
    "which topics can i ask?",
  ])("explains supported question areas: %j", (message) => {
    expect(getLocalConversationalResponse(message)?.answer).toContain(
      "thrift-store donations",
    );
  });

  it("does not intercept an organization-information question", () => {
    expect(
      getLocalConversationalResponse(
        "Hello, who handles thrift store donations?",
      ),
    ).toBeUndefined();
  });
});
