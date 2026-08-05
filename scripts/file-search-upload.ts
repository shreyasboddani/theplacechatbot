import { request as httpsRequest } from "node:https";
import type { IncomingHttpHeaders } from "node:http";

import {
  UploadToFileSearchStoreOperation,
  type CustomMetadata,
} from "@google/genai";

const GEMINI_UPLOAD_ORIGIN = "https://generativelanguage.googleapis.com";
const MAX_RESPONSE_BYTES = 1_000_000;
const DEFAULT_TIMEOUT_MS = 60_000;

export interface FileSearchUploadRequest {
  apiKey: string;
  storeName: string;
  content: Uint8Array;
  displayName: string;
  mimeType: string;
  customMetadata: CustomMetadata[];
  chunkingConfig: {
    whiteSpaceConfig: {
      maxTokensPerChunk: number;
      maxOverlapTokens: number;
    };
  };
}

export interface HttpsTransportRequest {
  url: URL;
  headers: Record<string, string>;
  body: Uint8Array;
  timeoutMs: number;
}

export interface HttpsTransportResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: Uint8Array;
}

export type HttpsTransport = (
  request: HttpsTransportRequest,
) => Promise<HttpsTransportResponse>;

class FileSearchUploadError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, details: { status?: number; code?: string } = {}) {
    super(message);
    this.name = "FileSearchUploadError";
    this.status = details.status;
    this.code = details.code;
  }
}

function utf8(value: string): Uint8Array {
  return Buffer.from(value, "utf8");
}

function headerValue(
  headers: IncomingHttpHeaders,
  name: string,
): string | undefined {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function responseErrorDetails(response: HttpsTransportResponse): {
  status?: number;
  code?: string;
} {
  let code: string | undefined;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(response.body).toString("utf8"));
    if (parsed && typeof parsed === "object") {
      const error = (parsed as Record<string, unknown>).error;
      if (error && typeof error === "object") {
        const status = (error as Record<string, unknown>).status;
        if (typeof status === "string") code = status;
      }
    }
  } catch {
    // Provider response text is deliberately excluded from logs and errors.
  }
  return {
    ...(response.statusCode ? { status: response.statusCode } : {}),
    ...(code ? { code } : {}),
  };
}

function requireSuccessfulResponse(
  response: HttpsTransportResponse,
  stage: "session" | "content",
): void {
  if (response.statusCode >= 200 && response.statusCode < 300) return;
  throw new FileSearchUploadError(
    `Gemini File Search ${stage} upload request failed.`,
    responseErrorDetails(response),
  );
}

function requireStoreName(storeName: string): string {
  if (!/^fileSearchStores\/[a-zA-Z0-9_-]+$/.test(storeName)) {
    throw new FileSearchUploadError("The File Search store name is invalid.");
  }
  return storeName;
}

export function requireTrustedGeminiUploadUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new FileSearchUploadError("Gemini returned an invalid upload URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "generativelanguage.googleapis.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    !url.pathname.startsWith("/upload/")
  ) {
    throw new FileSearchUploadError("Gemini returned an untrusted upload URL.");
  }
  return url;
}

export const nodeHttpsTransport: HttpsTransport = async ({
  url,
  headers,
  body,
  timeoutMs,
}) =>
  new Promise<HttpsTransportResponse>((resolve, reject) => {
    const request = httpsRequest(
      url,
      { method: "POST", headers },
      (response) => {
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        response.on("data", (chunk: Buffer | Uint8Array | string) => {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += bytes.length;
          if (totalBytes > MAX_RESPONSE_BYTES) {
            response.destroy(
              new FileSearchUploadError("Gemini upload response was too large."),
            );
            return;
          }
          chunks.push(bytes);
        });
        response.once("error", reject);
        response.once("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    request.setTimeout(timeoutMs, () => {
      const error = Object.assign(
        new Error("Gemini File Search HTTPS request timed out."),
        { code: "ETIMEDOUT" },
      );
      request.destroy(error);
    });
    request.once("error", reject);
    request.end(body);
  });

export async function uploadToFileSearchStoreOverHttps(
  request: FileSearchUploadRequest,
  transport: HttpsTransport = nodeHttpsTransport,
): Promise<UploadToFileSearchStoreOperation> {
  const storeName = requireStoreName(request.storeName);
  const apiKey = request.apiKey.trim();
  if (!apiKey) {
    throw new FileSearchUploadError("The Gemini API key is missing.");
  }
  if (request.content.byteLength === 0) {
    throw new FileSearchUploadError("The prepared document is empty.");
  }

  const sessionBody = utf8(
    JSON.stringify({
      displayName: request.displayName,
      mimeType: request.mimeType,
      customMetadata: request.customMetadata,
      chunkingConfig: request.chunkingConfig,
    }),
  );
  const sessionUrl = new URL(
    `/upload/v1beta/${storeName}:uploadToFileSearchStore`,
    GEMINI_UPLOAD_ORIGIN,
  );
  const sessionResponse = await transport({
    url: sessionUrl,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(sessionBody.byteLength),
      "X-Goog-Api-Key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(
        request.content.byteLength,
      ),
      "X-Goog-Upload-Header-Content-Type": request.mimeType,
      "X-Goog-Upload-File-Name": request.displayName,
    },
    body: sessionBody,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
  requireSuccessfulResponse(sessionResponse, "session");

  const uploadUrlHeader = headerValue(
    sessionResponse.headers,
    "x-goog-upload-url",
  );
  if (!uploadUrlHeader) {
    throw new FileSearchUploadError(
      "Gemini did not return a resumable upload URL.",
    );
  }
  const uploadUrl = requireTrustedGeminiUploadUrl(uploadUrlHeader);
  const uploadResponse = await transport({
    url: uploadUrl,
    headers: {
      "Content-Type": request.mimeType,
      "Content-Length": String(request.content.byteLength),
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-File-Name": request.displayName,
    },
    body: request.content,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
  requireSuccessfulResponse(uploadResponse, "content");
  if (
    headerValue(uploadResponse.headers, "x-goog-upload-status")?.toLowerCase() !==
    "final"
  ) {
    throw new FileSearchUploadError(
      "Gemini did not finalize the File Search upload.",
    );
  }

  let operation: unknown;
  try {
    operation = JSON.parse(Buffer.from(uploadResponse.body).toString("utf8"));
  } catch {
    throw new FileSearchUploadError(
      "Gemini returned an invalid File Search operation.",
    );
  }
  if (
    !operation ||
    typeof operation !== "object" ||
    typeof (operation as Record<string, unknown>).name !== "string"
  ) {
    throw new FileSearchUploadError(
      "Gemini returned an invalid File Search operation.",
    );
  }
  const typedOperation = new UploadToFileSearchStoreOperation();
  Object.assign(typedOperation, operation);
  return typedOperation;
}
