import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_GEMINI_MODEL,
  getRuntimeConfig,
} from "@/lib/config";

const originalModel = process.env.GEMINI_MODEL;

afterEach(() => {
  if (originalModel === undefined) delete process.env.GEMINI_MODEL;
  else process.env.GEMINI_MODEL = originalModel;
});

describe("Gemini model configuration", () => {
  it("defaults to the stable Flash-Lite model", () => {
    delete process.env.GEMINI_MODEL;

    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.1-flash-lite");
    expect(getRuntimeConfig().model).toBe("gemini-3.1-flash-lite");
  });

  it("still honors an explicit model override", () => {
    process.env.GEMINI_MODEL = "custom-model";

    expect(getRuntimeConfig().model).toBe("custom-model");
  });
});
