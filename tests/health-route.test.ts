// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

const originalKey = process.env.GEMINI_API_KEY;
const originalStore = process.env.GEMINI_FILE_SEARCH_STORE;

afterEach(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  if (originalStore === undefined) delete process.env.GEMINI_FILE_SEARCH_STORE;
  else process.env.GEMINI_FILE_SEARCH_STORE = originalStore;
});

describe("health route", () => {
  it("reports readiness without exposing model or configuration details", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_FILE_SEARCH_STORE = "fileSearchStores/example";

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("returns 503 when the service is not configured", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_FILE_SEARCH_STORE;

    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
});
