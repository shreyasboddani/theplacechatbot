import { describe, expect, it, vi } from "vitest";

import {
  buildVercelCommandPlan,
  runVercelBuild,
} from "../scripts/vercel-build";

describe("Vercel production knowledge synchronization", () => {
  it("syncs the verified corpus before the production build", () => {
    expect(
      buildVercelCommandPlan({
        VERCEL_ENV: "production",
        GEMINI_API_KEY: "configured",
        GEMINI_FILE_SEARCH_STORE: "fileSearchStores/existing",
      }),
    ).toEqual([
      ["run", "knowledge:verify"],
      ["run", "knowledge:sync", "--", "--reconcile", "--apply"],
      ["run", "build"],
    ]);
  });

  it("never mutates Gemini for preview or development builds", () => {
    expect(buildVercelCommandPlan({ VERCEL_ENV: "preview" })).toEqual([
      ["run", "build"],
    ]);
    expect(buildVercelCommandPlan({ VERCEL_ENV: "development" })).toEqual([
      ["run", "build"],
    ]);
  });

  it("fails closed when the deployment target is unknown", () => {
    expect(() => buildVercelCommandPlan({})).toThrow("VERCEL_ENV is missing");
  });

  it("fails closed when production Gemini configuration is incomplete", () => {
    expect(() =>
      buildVercelCommandPlan({ VERCEL_ENV: "production" }),
    ).toThrow("GEMINI_API_KEY, GEMINI_FILE_SEARCH_STORE");
  });

  it("runs every production command in order", async () => {
    const runner = vi.fn(async (args: string[]) => {
      void args;
    });
    await runVercelBuild(
      {
        VERCEL_ENV: "production",
        GEMINI_API_KEY: "configured",
        GEMINI_FILE_SEARCH_STORE: "fileSearchStores/existing",
      },
      runner,
    );
    expect(runner.mock.calls.map(([args]) => args)).toEqual([
      ["run", "knowledge:verify"],
      ["run", "knowledge:sync", "--", "--reconcile", "--apply"],
      ["run", "build"],
    ]);
  });
});
