import { z } from "zod";

import { MAX_ASSISTANT_ANSWER_LENGTH } from "@/lib/chat/limits";
import { contactFallback } from "@/lib/contact-fallback";
import { resolveFileCitations } from "@/lib/gemini/citations";
import type { FileCitationAnnotation } from "@/lib/gemini/citations";
import {
  buildInteractionInput,
  SYSTEM_INSTRUCTION,
} from "@/lib/gemini/prompts";
import type {
  ChatResponse,
  SourceManifestEntry,
} from "@/lib/knowledge/types";
import type { ChatRequest } from "@/lib/security/input-validation";

const modelPayloadSchema = z.object({
  status: z.enum(["answered", "not_found", "conflicting_information"]),
  answer: z.string().trim().max(MAX_ASSISTANT_ANSWER_LENGTH),
});

interface TextBlock {
  type: "text";
  text: string;
  annotations?: FileCitationAnnotation[];
}

interface InteractionStep {
  type: string;
  content?: TextBlock[];
}

export interface GroundedInteraction {
  status?: string;
  steps: InteractionStep[];
}

export interface GroundedInteractionClient {
  create(params: {
    model: string;
    input: ReturnType<typeof buildInteractionInput>;
    system_instruction: string;
    store: false;
    tools: Array<{
      type: "file_search";
      file_search_store_names: string[];
    }>;
    response_format: {
      type: "text";
      mime_type: "application/json";
      schema: Record<string, unknown>;
    };
  }): Promise<GroundedInteraction>;
}

export function buildGroundedInteractionParams(
  request: ChatRequest,
  model: string,
  fileSearchStore: string,
) {
  return {
    model,
    input: buildInteractionInput(request),
    system_instruction: SYSTEM_INSTRUCTION,
    store: false as const,
    tools: [
      {
        type: "file_search" as const,
        file_search_store_names: [fileSearchStore],
      },
    ],
    response_format: {
      type: "text" as const,
      mime_type: "application/json" as const,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          status: {
            type: "string",
            enum: ["answered", "not_found", "conflicting_information"],
          },
          answer: { type: "string" },
        },
        required: ["status", "answer"],
      },
    },
  };
}

export function interpretGroundedInteraction(
  interaction: GroundedInteraction,
  manifest: SourceManifestEntry[],
): ChatResponse {
  const textBlocks = interaction.steps.flatMap((step) =>
    step.type === "model_output" ? (step.content ?? []) : [],
  );
  const text = textBlocks.map((block) => block.text).join("").trim();
  const annotations = textBlocks.flatMap((block) => block.annotations ?? []);
  const sources = resolveFileCitations(annotations, manifest);

  let parsed: z.infer<typeof modelPayloadSchema>;
  try {
    parsed = modelPayloadSchema.parse(JSON.parse(text));
  } catch {
    return contactFallback();
  }

  if (parsed.status === "conflicting_information") {
    return contactFallback("conflicting_information", sources);
  }
  if (parsed.status !== "answered" || sources.length === 0 || !parsed.answer) {
    return contactFallback();
  }

  return {
    status: "answered",
    answer: parsed.answer,
    sources,
    contactRecommended: false,
  };
}

export async function askGroundedQuestion(
  client: GroundedInteractionClient,
  request: ChatRequest,
  options: {
    model: string;
    fileSearchStore: string;
    manifest: SourceManifestEntry[];
  },
): Promise<ChatResponse> {
  const params = buildGroundedInteractionParams(
    request,
    options.model,
    options.fileSearchStore,
  );
  const interaction = await client.create(params);
  return interpretGroundedInteraction(interaction, options.manifest);
}
