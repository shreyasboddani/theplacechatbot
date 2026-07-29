import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  CustomMetadata,
  Document,
  UploadToFileSearchStoreOperation,
} from "@google/genai";
import { loadEnvConfig } from "@next/env";

import { createGeminiClient } from "../src/lib/gemini/client";
import type { SourceManifestEntry } from "../src/lib/knowledge/types";
import {
  resolvePreparedDocumentPath,
  verifyKnowledgeSnapshot,
} from "./verify-knowledge";

const POLL_INTERVAL_MS = 2_000;
const OPERATION_TIMEOUT_MS = 10 * 60 * 1_000;
const UPLOAD_ATTEMPTS = 3;
const MANAGED_BY = "the-place-chatbot";

export interface DesiredDocumentFingerprint {
  sourceId: string;
  contentHash: string;
}

export interface RemoteDocumentFingerprint {
  name?: string;
  sourceId?: string;
  contentHash?: string;
  managedBy?: string;
  state?: string;
}

export interface ReconcileDeletion {
  name: string;
  sourceId?: string;
  reason: "replaced" | "duplicate" | "obsolete";
}

export interface ReconcilePlan {
  uploads: string[];
  deletions: ReconcileDeletion[];
  unchanged: string[];
  unknownRemoteDocuments: string[];
}

interface PreparedDocument {
  source: SourceManifestEntry;
  absolutePath: string;
  contentHash: string;
}

function stringMetadata(key: string, value: string): CustomMetadata {
  return { key, stringValue: value };
}

function metadataValue(document: Document, key: string): string | undefined {
  return document.customMetadata?.find((item) => item.key === key)?.stringValue;
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function remoteDocumentFingerprint(document: Document): RemoteDocumentFingerprint {
  return {
    ...(document.name ? { name: document.name } : {}),
    ...(metadataValue(document, "source_id")
      ? { sourceId: metadataValue(document, "source_id") }
      : {}),
    ...(metadataValue(document, "content_sha256")
      ? { contentHash: metadataValue(document, "content_sha256") }
      : {}),
    ...(metadataValue(document, "managed_by")
      ? { managedBy: metadataValue(document, "managed_by") }
      : {}),
    ...(document.state ? { state: String(document.state) } : {}),
  };
}

function isActiveDocument(document: RemoteDocumentFingerprint): boolean {
  return (
    document.state === undefined ||
    document.state === "STATE_ACTIVE" ||
    document.state === "ACTIVE"
  );
}

export function buildReconcilePlan(
  desiredDocuments: DesiredDocumentFingerprint[],
  remoteDocuments: RemoteDocumentFingerprint[],
): ReconcilePlan {
  const desiredIds = new Set<string>();
  for (const desired of desiredDocuments) {
    if (desiredIds.has(desired.sourceId)) {
      throw new Error(`Duplicate desired source ID: ${desired.sourceId}`);
    }
    desiredIds.add(desired.sourceId);
  }

  const unknownRemoteDocuments: string[] = [];
  const remoteBySource = new Map<string, RemoteDocumentFingerprint[]>();
  for (const remote of remoteDocuments) {
    if (
      !remote.name ||
      !remote.sourceId ||
      remote.managedBy !== MANAGED_BY
    ) {
      unknownRemoteDocuments.push(remote.name || "unnamed-document");
      continue;
    }
    const existing = remoteBySource.get(remote.sourceId) ?? [];
    existing.push(remote);
    remoteBySource.set(remote.sourceId, existing);
  }

  const uploads: string[] = [];
  const deletions: ReconcileDeletion[] = [];
  const unchanged: string[] = [];
  for (const desired of desiredDocuments) {
    const candidates = remoteBySource.get(desired.sourceId) ?? [];
    const exact = candidates.filter(
      (candidate) =>
        candidate.contentHash === desired.contentHash &&
        isActiveDocument(candidate),
    );
    if (exact.length === 0) {
      uploads.push(desired.sourceId);
      deletions.push(
        ...candidates.flatMap((candidate) =>
          candidate.name
            ? [
                {
                  name: candidate.name,
                  sourceId: desired.sourceId,
                  reason: "replaced" as const,
                },
              ]
            : [],
        ),
      );
      continue;
    }

    unchanged.push(desired.sourceId);
    const retainedName = exact[0]?.name;
    deletions.push(
      ...candidates.flatMap((candidate) =>
        candidate.name && candidate.name !== retainedName
          ? [
              {
                name: candidate.name,
                sourceId: desired.sourceId,
                reason: "duplicate" as const,
              },
            ]
          : [],
      ),
    );
  }

  for (const [sourceId, documents] of remoteBySource) {
    if (desiredIds.has(sourceId)) continue;
    deletions.push(
      ...documents.flatMap((document) =>
        document.name
          ? [
              {
                name: document.name,
                sourceId,
                reason: "obsolete" as const,
              },
            ]
          : [],
      ),
    );
  }

  return { uploads, deletions, unchanged, unknownRemoteDocuments };
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
    const operationError = new Error(
      "Gemini reported an indexing failure for this document.",
    ) as Error & { status?: number; code?: string };
    if (typeof current.error.code === "number") {
      operationError.status = current.error.code;
    }
    if (typeof current.error.status === "string") {
      operationError.code = current.error.status;
    }
    throw operationError;
  }
}

function nestedErrorDetails(value: unknown): {
  status?: number;
  code?: string;
} {
  if (!(value instanceof Error)) return {};
  try {
    const parsed: unknown = JSON.parse(value.message);
    if (!parsed || typeof parsed !== "object") return {};
    const error = (parsed as Record<string, unknown>).error;
    if (!error || typeof error !== "object") return {};
    const nested = error as Record<string, unknown>;
    return {
      ...(typeof nested.code === "number" ? { status: nested.code } : {}),
      ...(typeof nested.status === "string" ? { code: nested.status } : {}),
    };
  } catch {
    return {};
  }
}

export function safeFileSearchErrorDetails(value: unknown): {
  name: string;
  status?: number;
  code?: string;
} {
  if (!(value instanceof Error)) return { name: "UnknownError" };
  const error = value as Error & { status?: unknown; code?: unknown };
  const nested = nestedErrorDetails(error);
  const status =
    typeof error.status === "number"
      ? error.status
      : typeof error.code === "number"
        ? error.code
        : nested.status;
  const code =
    typeof error.code === "string"
      ? error.code
      : nested.code;
  return {
    name: error.name || "Error",
    ...(status !== undefined ? { status } : {}),
    ...(code ? { code } : {}),
  };
}

export function isRetryableFileSearchError(value: unknown): boolean {
  const details = safeFileSearchErrorDetails(value);
  if (
    details.status === 408 ||
    details.status === 409 ||
    details.status === 429 ||
    (details.status !== undefined && details.status >= 500)
  ) {
    return true;
  }
  if (
    details.code &&
    [
      "ABORTED",
      "DEADLINE_EXCEEDED",
      "INTERNAL",
      "RESOURCE_EXHAUSTED",
      "UNAVAILABLE",
    ].includes(details.code)
  ) {
    return true;
  }
  return (
    value instanceof Error &&
    /(?:fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|upload status is not finalized)/i.test(
      value.message,
    )
  );
}

export function preparedDocumentMimeType(fileName: string): string {
  return path.extname(fileName).toLowerCase() === ".pdf"
    ? "application/pdf"
    : "text/markdown";
}

export async function retryTransientFileSearchOperation<T>(
  operation: () => Promise<T>,
  options: {
    attempts?: number;
    delay?: (milliseconds: number) => Promise<void>;
    onRetry?: (
      details: ReturnType<typeof safeFileSearchErrorDetails>,
      nextAttempt: number,
      attempts: number,
    ) => void;
  } = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? UPLOAD_ATTEMPTS);
  const delay =
    options.delay ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error: unknown) {
      if (!isRetryableFileSearchError(error) || attempt === attempts) {
        throw error;
      }
      options.onRetry?.(
        safeFileSearchErrorDetails(error),
        attempt + 1,
        attempts,
      );
      await delay(POLL_INTERVAL_MS * 2 ** (attempt - 1));
    }
  }
  throw new Error("File Search retry loop ended unexpectedly.");
}

function isManifestEntry(value: unknown): value is SourceManifestEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.fileName === "string" &&
    typeof entry.documentPath === "string" &&
    typeof entry.title === "string" &&
    (entry.sourceType === "official_website" ||
      entry.sourceType === "official_document" ||
      entry.sourceType === "manager_faq") &&
    typeof entry.priority === "number" &&
    (entry.contentHash === undefined || typeof entry.contentHash === "string")
  );
}

async function preparedDocuments(
  root: string,
  sources: SourceManifestEntry[],
): Promise<PreparedDocument[]> {
  return Promise.all(
    sources.map(async (source) => {
      const absolutePath = resolvePreparedDocumentPath(root, source.documentPath);
      if (!absolutePath || path.basename(absolutePath) !== source.fileName) {
        throw new Error(`Source ${source.id} has an unsafe document path.`);
      }
      const content = await readFile(absolutePath);
      const contentHash = sha256(content);
      if (source.contentHash && source.contentHash !== contentHash) {
        throw new Error(`Source ${source.id} failed its content hash check.`);
      }
      return { source, absolutePath, contentHash };
    }),
  );
}

function uploadMetadata(document: PreparedDocument): CustomMetadata[] {
  const { source } = document;
  return [
    stringMetadata("managed_by", MANAGED_BY),
    stringMetadata("source_id", source.id),
    stringMetadata("source_type", source.sourceType),
    stringMetadata("content_sha256", document.contentHash),
    stringMetadata("title", source.title.slice(0, 500)),
    stringMetadata("priority", String(source.priority)),
    ...(source.url ? [stringMetadata("canonical_url", source.url)] : []),
    ...(source.fetchedAt
      ? [stringMetadata("fetched_at", source.fetchedAt)]
      : []),
  ];
}

async function listRemoteDocuments(
  ai: ReturnType<typeof createGeminiClient>,
  storeName: string,
): Promise<RemoteDocumentFingerprint[]> {
  const pager = await ai.fileSearchStores.documents.list({
    parent: storeName,
    config: { pageSize: 20, httpOptions: { timeout: 30_000 } },
  });
  const documents: RemoteDocumentFingerprint[] = [];
  for await (const document of pager) {
    documents.push(remoteDocumentFingerprint(document));
  }
  return documents;
}

async function uploadDocuments(
  ai: ReturnType<typeof createGeminiClient>,
  storeName: string,
  documents: PreparedDocument[],
) {
  const failures: Array<{ sourceId: string; reason: string }> = [];
  let uploaded = 0;
  for (const document of documents) {
    try {
      await retryTransientFileSearchOperation(
        async () => {
          const operation = await ai.fileSearchStores.uploadToFileSearchStore({
            fileSearchStoreName: storeName,
            file: document.absolutePath,
            config: {
              displayName: document.source.fileName,
              mimeType: preparedDocumentMimeType(document.source.fileName),
              customMetadata: uploadMetadata(document),
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
        },
        {
          onRetry: (details, nextAttempt, attempts) => {
            process.stderr.write(
              `Transient File Search upload failure for ${document.source.id}; retrying attempt ${nextAttempt}/${attempts} (${JSON.stringify(details)}).\n`,
            );
          },
        },
      );
      uploaded += 1;
      process.stdout.write(`Indexed ${document.source.fileName}\n`);
    } catch (error: unknown) {
      const details = safeFileSearchErrorDetails(error);
      failures.push({
        sourceId: document.source.id,
        reason: `Gemini upload or indexing failed (${JSON.stringify(details)}).`,
      });
      process.stderr.write(
        `Failed to index ${document.source.fileName} (${JSON.stringify(details)}).\n`,
      );
    }
  }
  return { uploaded, failures };
}

async function planAfterUploads(
  ai: ReturnType<typeof createGeminiClient>,
  storeName: string,
  desired: DesiredDocumentFingerprint[],
): Promise<ReconcilePlan> {
  let latestPlan: ReconcilePlan | undefined;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    latestPlan = buildReconcilePlan(
      desired,
      await listRemoteDocuments(ai, storeName),
    );
    if (
      latestPlan.uploads.length === 0 ||
      latestPlan.unknownRemoteDocuments.length > 0
    ) {
      return latestPlan;
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
  return latestPlan as ReconcilePlan;
}

async function deleteDocuments(
  ai: ReturnType<typeof createGeminiClient>,
  deletions: ReconcileDeletion[],
) {
  const failures: Array<{ sourceId?: string; reason: string }> = [];
  let deleted = 0;
  for (const deletion of deletions) {
    try {
      await retryTransientFileSearchOperation(
        () =>
          ai.fileSearchStores.documents.delete({
            name: deletion.name,
            config: { force: true, httpOptions: { timeout: 30_000 } },
          }),
        {
          onRetry: (details, nextAttempt, attempts) => {
            process.stderr.write(
              `Transient File Search deletion failure for ${deletion.sourceId ?? "unknown source"}; retrying attempt ${nextAttempt}/${attempts} (${JSON.stringify(details)}).\n`,
            );
          },
        },
      );
      deleted += 1;
      process.stdout.write(
        `Removed ${deletion.reason} document for ${deletion.sourceId ?? "unknown source"}\n`,
      );
    } catch (error: unknown) {
      failures.push({
        ...(deletion.sourceId ? { sourceId: deletion.sourceId } : {}),
        reason: `Gemini document deletion failed (${JSON.stringify(safeFileSearchErrorDetails(error))}).`,
      });
      process.stderr.write(
        `Failed to remove stale document for ${deletion.sourceId ?? "unknown source"} (${JSON.stringify(safeFileSearchErrorDetails(error))}).\n`,
      );
    }
  }
  return { deleted, failures };
}

async function verifyRemoteDocuments(
  ai: ReturnType<typeof createGeminiClient>,
  storeName: string,
  desired: DesiredDocumentFingerprint[],
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const remote = await listRemoteDocuments(ai, storeName);
    const plan = buildReconcilePlan(desired, remote);
    if (
      plan.uploads.length === 0 &&
      plan.deletions.length === 0 &&
      plan.unknownRemoteDocuments.length === 0 &&
      plan.unchanged.length === desired.length
    ) {
      return;
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
  throw new Error("Remote File Search verification did not match the approved corpus.");
}

async function writeSyncReport(
  generatedDir: string,
  values: {
    storeName: string;
    displayName?: string;
    mode: "new-store" | "reconcile";
    desiredDocuments: number;
    uploaded: number;
    deleted: number;
    unchanged: number;
    uploadFailures: Array<{ sourceId: string; reason: string }>;
    deleteFailures: Array<{ sourceId?: string; reason: string }>;
  },
) {
  const syncedAt = new Date().toISOString();
  const syncReportPath = path.join(generatedDir, "sync-report.json");
  const syncReportValue: unknown = JSON.parse(
    await readFile(syncReportPath, "utf8"),
  );
  const syncReport =
    syncReportValue && typeof syncReportValue === "object"
      ? (syncReportValue as Record<string, unknown>)
      : {};
  await Promise.all([
    writeFile(
      path.join(generatedDir, "file-search-store.json"),
      `${JSON.stringify(
        {
          storeName: values.storeName,
          displayName: values.displayName,
          syncedAt,
          managedDocuments: values.desiredDocuments,
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
    writeFile(
      syncReportPath,
      `${JSON.stringify(
        {
          ...syncReport,
          syncMode: values.mode,
          totalDocumentsUploaded: values.uploaded,
          totalDocumentsDeleted: values.deleted,
          totalDocumentsUnchanged: values.unchanged,
          managedDocumentsAfterSync: values.desiredDocuments,
          uploadFailures: values.uploadFailures,
          deleteFailures: values.deleteFailures,
          fileSearchStoreName: values.storeName,
          uploadedAt: syncedAt,
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);
}

async function main() {
  const createNewStore = process.argv.includes("--new-store");
  const reconcile = process.argv.includes("--reconcile");
  const apply = process.argv.includes("--apply");
  if (createNewStore === reconcile) {
    throw new Error(
      "Choose exactly one sync mode: --new-store or --reconcile.",
    );
  }
  if (apply && !reconcile) {
    throw new Error("--apply is only valid with --reconcile.");
  }

  const root = process.cwd();
  await verifyKnowledgeSnapshot(root);
  loadEnvConfig(root);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. No upload was attempted.");
  }

  const generatedDir = path.resolve(root, "knowledge/generated");
  const sourcesValue: unknown = JSON.parse(
    await readFile(path.join(generatedDir, "sources.json"), "utf8"),
  );
  if (!Array.isArray(sourcesValue) || !sourcesValue.every(isManifestEntry)) {
    throw new Error("sources.json is invalid. Run npm run knowledge:prepare first.");
  }
  if (sourcesValue.length === 0) {
    throw new Error("No approved documents are prepared for upload.");
  }
  const documents = await preparedDocuments(root, sourcesValue);
  const desired = documents.map((document) => ({
    sourceId: document.source.id,
    contentHash: document.contentHash,
  }));
  const bySourceId = new Map(
    documents.map((document) => [document.source.id, document]),
  );
  const ai = createGeminiClient(apiKey, {
    timeout: 60_000,
    retryOptions: { attempts: 5 },
  });

  if (createNewStore) {
    const store = await ai.fileSearchStores.create({
      config: {
        displayName: `The Place grounded knowledge ${new Date()
          .toISOString()
          .replace(/[:.]/g, "-")}`,
        embeddingModel: "models/gemini-embedding-001",
      },
    });
    if (!store.name) {
      throw new Error("Gemini did not return a File Search store name.");
    }
    const uploadResult = await uploadDocuments(ai, store.name, documents);
    if (uploadResult.failures.length === 0) {
      await verifyRemoteDocuments(ai, store.name, desired);
    }
    await writeSyncReport(generatedDir, {
      storeName: store.name,
      displayName: store.displayName,
      mode: "new-store",
      desiredDocuments: documents.length,
      uploaded: uploadResult.uploaded,
      deleted: 0,
      unchanged: 0,
      uploadFailures: uploadResult.failures,
      deleteFailures: [],
    });
    process.stdout.write(`GEMINI_FILE_SEARCH_STORE=${store.name}\n`);
    if (uploadResult.failures.length > 0) {
      throw new Error(`${uploadResult.failures.length} document upload(s) failed.`);
    }
    return;
  }

  const configuredStore = process.env.GEMINI_FILE_SEARCH_STORE?.trim();
  if (!configuredStore) {
    throw new Error(
      "GEMINI_FILE_SEARCH_STORE is required for --reconcile mode.",
    );
  }
  const store = await ai.fileSearchStores.get({ name: configuredStore });
  if (!store.name) throw new Error("Gemini did not return the configured store.");
  const remoteDocuments = await listRemoteDocuments(ai, store.name);
  const plan = buildReconcilePlan(desired, remoteDocuments);
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: apply ? "reconcile-apply" : "reconcile-preview",
        desiredDocuments: desired.length,
        remoteDocuments: remoteDocuments.length,
        uploads: plan.uploads.length,
        deletions: plan.deletions.length,
        unchanged: plan.unchanged.length,
        unknownRemoteDocuments: plan.unknownRemoteDocuments.length,
      },
      null,
      2,
    )}\n`,
  );
  if (!apply) {
    process.stdout.write(
      "Preview only. Re-run with --reconcile --apply after reviewing the plan.\n",
    );
    return;
  }
  if (plan.unknownRemoteDocuments.length > 0) {
    throw new Error(
      "The store contains unmanaged documents. No upload or deletion was attempted.",
    );
  }

  const documentsToUpload = plan.uploads.flatMap((sourceId) => {
    const document = bySourceId.get(sourceId);
    return document ? [document] : [];
  });
  const uploadResult = await uploadDocuments(
    ai,
    store.name,
    documentsToUpload,
  );
  if (uploadResult.failures.length > 0) {
    await writeSyncReport(generatedDir, {
      storeName: store.name,
      displayName: store.displayName,
      mode: "reconcile",
      desiredDocuments: documents.length,
      uploaded: uploadResult.uploaded,
      deleted: 0,
      unchanged: plan.unchanged.length,
      uploadFailures: uploadResult.failures,
      deleteFailures: [],
    });
    throw new Error(
      `${uploadResult.failures.length} upload(s) failed; existing documents were preserved.`,
    );
  }

  const cleanupPlan = await planAfterUploads(ai, store.name, desired);
  if (
    cleanupPlan.unknownRemoteDocuments.length > 0 ||
    cleanupPlan.uploads.length > 0
  ) {
    await writeSyncReport(generatedDir, {
      storeName: store.name,
      displayName: store.displayName,
      mode: "reconcile",
      desiredDocuments: documents.length,
      uploaded: uploadResult.uploaded,
      deleted: 0,
      unchanged: cleanupPlan.unchanged.length,
      uploadFailures: cleanupPlan.uploads.map((sourceId) => ({
        sourceId,
        reason: "The replacement was not active after upload; existing documents were preserved.",
      })),
      deleteFailures: [],
    });
    throw new Error(
      "The replacement documents were not fully active after upload; existing documents were preserved.",
    );
  }

  const deleteResult = await deleteDocuments(ai, cleanupPlan.deletions);
  if (deleteResult.failures.length === 0) {
    await verifyRemoteDocuments(ai, store.name, desired);
  }
  await writeSyncReport(generatedDir, {
    storeName: store.name,
    displayName: store.displayName,
    mode: "reconcile",
    desiredDocuments: documents.length,
    uploaded: uploadResult.uploaded,
    deleted: deleteResult.deleted,
    unchanged: desired.length,
    uploadFailures: [],
    deleteFailures: deleteResult.failures,
  });
  if (deleteResult.failures.length > 0) {
    throw new Error(`${deleteResult.failures.length} stale document deletion(s) failed.`);
  }
  process.stdout.write(`GEMINI_FILE_SEARCH_STORE=${store.name}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    process.stderr.write(`File Search sync failed: ${message}\n`);
    process.exitCode = 1;
  });
}
