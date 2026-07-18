// @vitest-environment node

import { describe, expect, it } from "vitest";

import { maxDuration } from "@/app/api/chat/route";
import {
  BROWSER_CHAT_REQUEST_TIMEOUT_MS,
  CHAT_ROUTE_MAX_DURATION_SECONDS,
  GEMINI_REQUEST_TIMEOUT_MS,
} from "@/lib/chat/limits";

describe("coordinated chat timeouts", () => {
  it("gives Gemini enough time while each outer layer remains longer", () => {
    expect(GEMINI_REQUEST_TIMEOUT_MS).toBe(45_000);
    expect(BROWSER_CHAT_REQUEST_TIMEOUT_MS).toBe(55_000);
    expect(CHAT_ROUTE_MAX_DURATION_SECONDS).toBe(60);
    expect(GEMINI_REQUEST_TIMEOUT_MS).toBeLessThan(
      BROWSER_CHAT_REQUEST_TIMEOUT_MS,
    );
    expect(BROWSER_CHAT_REQUEST_TIMEOUT_MS).toBeLessThan(
      CHAT_ROUTE_MAX_DURATION_SECONDS * 1_000,
    );
    expect(maxDuration).toBe(CHAT_ROUTE_MAX_DURATION_SECONDS);
  });
});
