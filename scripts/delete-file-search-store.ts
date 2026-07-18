import { pathToFileURL } from "node:url";

import { loadEnvConfig } from "@next/env";

import { createGeminiClient } from "../src/lib/gemini/client";

async function main() {
  loadEnvConfig(process.cwd());
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const storeName = process.argv.find((argument) =>
    argument.startsWith("fileSearchStores/"),
  );
  if (!storeName || !/^fileSearchStores\/[A-Za-z0-9._-]+$/.test(storeName)) {
    throw new Error(
      "Provide an exact store name, for example: fileSearchStores/example-store",
    );
  }
  if (!process.argv.includes("--confirm")) {
    throw new Error(
      "Deletion was not attempted. Re-run with --confirm after verifying the exact store name.",
    );
  }

  const ai = createGeminiClient(apiKey);
  await ai.fileSearchStores.delete({ name: storeName, config: { force: true } });
  process.stdout.write(`Deleted ${storeName}. This operation cannot be undone.\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `File Search store deletion failed: ${error instanceof Error ? error.message : "Unknown error"}\n`,
    );
    process.exitCode = 1;
  });
}

