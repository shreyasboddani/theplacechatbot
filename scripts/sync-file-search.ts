import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadEnvConfig } from "@next/env";
import type { CustomMetadata, UploadToFileSearchStoreOperation } from "@google/genai";

import { createGeminiClient } from "../src/lib/gemini/client";
import type { SourceManifestEntry } from "../src/lib/knowledge/types";

const POLL_INTERVAL_MS = 2_000;
const OPERATION_TIMEOUT_MS = 10 * 60 * 1_000;

function stringMetadata(key: string, value: string): CustomMetadata {
  return { key, stringValue: value };
}

async function waitForOperation(
  operation: UploadToFileSearchStoreOperation,
  getOperation: (
    current: UploadToFileSearchStoreOperation,
  ) => Promise<UploadToFileSearchStoreOperation>,
) {
  const startedAt = Date.now();
  let current = operation;
  while (!current.done) {
    if (Date.now() - startedAt > OPERATION_TIMEOUT_MS) {
      throw new Error("File Search indexing timed out after 10 minutes.");
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    current = await getOperation(current);
  }
  if (current.error) {
    throw new Error("Gemini reported an indexing failure for this document.");
  }
}

function isManifestEntry(value: unknown): value is SourceManifestEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.fileName === "string" &&
    typeof entry.documentPath === "string" &&
    typeof entry.title === "string" &&
    (entry.sourceType === "official_website" || entry.sourceType === "manager_faq") &&
    typeof entry.priority === "number"
  );
}

async function main() {
  const root = process.cwd();
  loadEnvConfig(root);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. No upload was attempted.",
    );
  }

  const generatedDir = path.resolve(root, "knowledge/generated");
  const sourcesValue: unknown = JSON.parse(
    await readFile(path.join(generatedDir, "sources.json"), "utf8"),
  );
  if (!Array.isArray(sourcesValue)) {
    throw new Error("sources.json is invalid. Run npm run knowledge:prepare first.");
  }
  const sources = sourcesValue.filter(isManifestEntry);
  if (sources.length === 0) {
    throw new Error("No approved documents are prepared for upload.");
  }

  const ai = createGeminiClient(apiKey);
  const configuredStore = process.env.GEMINI_FILE_SEARCH_STORE?.trim();
  const store = configuredStore
    ? await ai.fileSearchStores.get({ name: configuredStore })
    : await ai.fileSearchStores.create({
        config: {
          displayName: `The Place grounded knowledge ${new Date()
            .toISOString()
            .replace(/[:.]/g, "-")}`,
          embeddingModel: "models/gemini-embedding-001",
        },
      });
  if (!store.name) throw new Error("Gemini did not return a File Search store name.");

  const failures: Array<{ sourceId: string; reason: string }> = [];
  let uploaded = 0;
  for (const source of sources) {
    const metadata = [
      stringMetadata("source_id", source.id),
      stringMetadata("source_type", source.sourceType),
      stringMetadata("title", source.title.slice(0, 500)),
      stringMetadata("priority", String(source.priority)),
      ...(source.url ? [stringMetadata("canonical_url", source.url)] : []),
      ...(source.fetchedAt
        ? [stringMetadata("fetched_at", source.fetchedAt)]
        : []),
    ];
    try {
      const operation = await ai.fileSearchStores.uploadToFileSearchStore({
        fileSearchStoreName: store.name,
        file: path.resolve(root, source.documentPath),
        config: {
          displayName: source.fileName,
          mimeType: "text/markdown",
          customMetadata: metadata,
          chunkingConfig: {
            whiteSpaceConfig: {
              maxTokensPerChunk: 350,
              maxOverlapTokens: 50,
            },
          },
        },
      });
      await waitForOperation(operation, (current) =>
        ai.operations.get({ operation: current }),
      );
      uploaded += 1;
      process.stdout.write(`Indexed ${source.fileName}\n`);
    } catch (error: unknown) {
      failures.push({
        sourceId: source.id,
        reason: error instanceof Error ? error.message : "Unknown upload error",
      });
      process.stderr.write(`Failed to index ${source.fileName}\n`);
    }
  }

  const storeRecord = {
    storeName: store.name,
    displayName: store.displayName,
    syncedAt: new Date().toISOString(),
    uploadedDocuments: uploaded,
  };
  const syncReportPath = path.join(generatedDir, "sync-report.json");
  const syncReportValue: unknown = JSON.parse(await readFile(syncReportPath, "utf8"));
  const syncReport =
    syncReportValue && typeof syncReportValue === "object"
      ? (syncReportValue as Record<string, unknown>)
      : {};
  await Promise.all([
    writeFile(
      path.join(generatedDir, "file-search-store.json"),
      `${JSON.stringify(storeRecord, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      syncReportPath,
      `${JSON.stringify(
        {
          ...syncReport,
          totalDocumentsUploaded: uploaded,
          uploadFailures: failures,
          fileSearchStoreName: store.name,
          uploadedAt: storeRecord.syncedAt,
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);

  process.stdout.write(`GEMINI_FILE_SEARCH_STORE=${store.name}\n`);
  if (failures.length > 0) {
    throw new Error(`${failures.length} document upload(s) failed.`);
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    process.stderr.write(`File Search sync failed: ${message}\n`);
    process.exitCode = 1;
  });
}

