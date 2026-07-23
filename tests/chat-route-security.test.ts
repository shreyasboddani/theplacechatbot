// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  askGroundedQuestion: vi.fn(),
  createGroundedInteractionClient: vi.fn(),
}));

vi.mock("@/lib/gemini/chat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gemini/chat")>();
  return { ...actual, askGroundedQuestion: mocks.askGroundedQuestion };
});

vi.mock("@/lib/gemini/client", () => ({
  createGroundedInteractionClient: mocks.createGroundedInteractionClient,
}));

import { POST } from "@/app/api/chat/route";
import { MAX_HISTORY_CONTENT_LENGTH } from "@/lib/chat/limits";
import { resetRateLimitForTests } from "@/lib/security/rate-limit";

function chatRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetRateLimitForTests();
  mocks.askGroundedQuestion.mockReset();
  mocks.createGroundedInteractionClient.mockReset();
});

describe("chat route request safety", () => {
  it("requires application/json to prevent cross-origin form submissions", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ message: "Hello", history: [] }),
      }),
    );

    expect(response.status).toBe(415);
    expect((await response.json()).status).toBe("invalid_request");
    expect(mocks.askGroundedQuestion).not.toHaveBeenCalled();
  });

  it.each(["hello", "What questions can you answer?"])(
    "answers %j locally without spending a Gemini request",
    async (message) => {
      const response = await POST(chatRequest({ message, history: [] }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("answered");
      expect(body.sources[0]).toEqual(
        expect.objectContaining({
          url: "https://www.theplacega.org/",
          sourceType: "official_website",
        }),
      );
      expect(mocks.askGroundedQuestion).not.toHaveBeenCalled();
      expect(mocks.createGroundedInteractionClient).not.toHaveBeenCalled();
    },
  );

  it("returns a clear retry window after the temporary request limit", async () => {
    let response: Response | undefined;
    for (let index = 0; index < 21; index += 1) {
      response = await POST(chatRequest({ message: "hello", history: [] }));
    }

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBeTruthy();
    const body = await response?.json();
    expect(body.status).toBe("service_unavailable");
    expect(body.answer).toContain("temporary request limit");
    expect(body.answer).toContain("try again");
    expect(mocks.askGroundedQuestion).not.toHaveBeenCalled();
  });

  it("blocks sensitive information before Gemini is called", async () => {
    const response = await POST(
      chatRequest({ message: "My SSN is 123-45-6789", history: [] }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("sensitive_information");
    expect(body.answer).not.toContain("123-45-6789");
    expect(mocks.askGroundedQuestion).not.toHaveBeenCalled();
    expect(mocks.createGroundedInteractionClient).not.toHaveBeenCalled();
  });

  it("returns a useful history validation error and logs only safe issue metadata", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const secretMarker = "DO_NOT_LOG_THIS_TEXT";
    const response = await POST(
      chatRequest({
        message: "Who should I contact?",
        history: [
          {
            role: "assistant",
            content:
              secretMarker +
              "x".repeat(MAX_HISTORY_CONTENT_LENGTH + 1),
          },
        ],
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.status).toBe("invalid_request");
    expect(body.answer).toContain("recent conversation");
    expect(warn).toHaveBeenCalledWith(
      "Invalid chat request shape",
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ path: "history.0.content" }),
        ]),
      }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(secretMarker);
  });
});
