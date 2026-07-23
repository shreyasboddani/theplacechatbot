import { describe, expect, it } from "vitest";

import { maxDuration } from "@/app/api/chat/route";
import {
  CLIENT_REQUEST_TIMEOUT_MS,
  GEMINI_REQUEST_TIMEOUT_MS,
} from "@/lib/chat/limits";

describe("chat timeout coordination", () => {
  it("leaves time for each layer to return a controlled fallback", () => {
    expect(GEMINI_REQUEST_TIMEOUT_MS).toBe(45_000);
    expect(CLIENT_REQUEST_TIMEOUT_MS).toBe(55_000);
    expect(maxDuration).toBe(60);
    expect(GEMINI_REQUEST_TIMEOUT_MS).toBeLessThan(CLIENT_REQUEST_TIMEOUT_MS);
    expect(CLIENT_REQUEST_TIMEOUT_MS).toBeLessThan(maxDuration * 1_000);
  });
});
