import { NextRequest } from "next/server";

import {
  sensitiveInformationResponse,
  serviceUnavailableResponse,
} from "@/lib/contact-fallback";
import { getRuntimeConfig } from "@/lib/config";
import { askGroundedQuestion } from "@/lib/gemini/chat";
import { createGroundedInteractionClient } from "@/lib/gemini/client";
import { getKnowledgeManifest } from "@/lib/knowledge/manifest";
import type { ChatResponse } from "@/lib/knowledge/types";
import {
  MAX_REQUEST_BYTES,
  validateChatRequest,
} from "@/lib/security/input-validation";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { containsLikelySensitiveInformation } from "@/lib/security/sensitive-data";

export const runtime = "nodejs";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(body: ChatResponse, status = 200, extraHeaders?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: { ...RESPONSE_HEADERS, ...extraHeaders },
  });
}

function invalidRequest(answer: string): ChatResponse {
  return {
    status: "invalid_request",
    answer,
    sources: [],
    contactRecommended: false,
  };
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "anonymous";
}

function safeServiceErrorDetails(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return { type: typeof value };
  const error = value as Record<string, unknown>;
  return {
    type: value.constructor?.name || "Error",
    ...(typeof error.name === "string" ? { name: error.name } : {}),
    ...(typeof error.status === "number" || typeof error.status === "string"
      ? { status: error.status }
      : {}),
    ...(typeof error.code === "number" || typeof error.code === "string"
      ? { code: error.code }
      : {}),
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse(invalidRequest("That message is too large to process."), 413);
  }

  const rateLimit = checkRateLimit(clientKey(request));
  if (!rateLimit.allowed) {
    return jsonResponse(serviceUnavailableResponse(), 429, {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return jsonResponse(invalidRequest("The request could not be read."), 400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return jsonResponse(invalidRequest("That message is too large to process."), 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse(invalidRequest("The request must be valid JSON."), 400);
  }

  const validation = validateChatRequest(body);
  if (!validation.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Invalid chat request shape", { issues: validation.issues });
    }
    return jsonResponse(invalidRequest(validation.reason), 400);
  }

  if (
    containsLikelySensitiveInformation(validation.data.message) ||
    validation.data.history.some((item) =>
      containsLikelySensitiveInformation(item.content),
    )
  ) {
    return jsonResponse(sensitiveInformationResponse(), 200);
  }

  const config = getRuntimeConfig();
  if (!config.apiKey || !config.fileSearchStore) {
    return jsonResponse(serviceUnavailableResponse(), 503);
  }

  try {
    const response = await askGroundedQuestion(
      createGroundedInteractionClient(config.apiKey),
      validation.data,
      {
        model: config.model,
        fileSearchStore: config.fileSearchStore,
        manifest: getKnowledgeManifest(),
      },
    );
    return jsonResponse(response);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Grounded chat service failed", safeServiceErrorDetails(error));
    }
    return jsonResponse(serviceUnavailableResponse(), 503);
  }
}
