import { describe, expect, it, vi } from "vitest";

import {
  askGroundedQuestion,
  interpretGroundedInteraction,
} from "@/lib/gemini/chat";
import type { SourceManifestEntry } from "@/lib/knowledge/types";

const staffSource: SourceManifestEntry = {
  id: "office-hours",
  fileName: "manager_faq__office-hours.md",
  documentPath: "knowledge/generated/prepared/manager_faq__office-hours.md",
  title: "What are your office hours?",
  sourceType: "manager_faq",
  priority: 100,
};

function interaction(
  status: "answered" | "not_found" | "conflicting_information",
  withCitation = true,
) {
  return {
    steps: [
      {
        type: "model_output",
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ status, answer: "A supported answer." }),
            annotations: withCitation
              ? [
                  {
                    type: "file_citation",
                    custom_metadata: { source_id: "office-hours" },
                  },
                ]
              : [],
          },
        ],
      },
    ],
  };
}

describe("grounded interaction interpretation", () => {
  it("returns a supported answer with a mapped source", () => {
    const result = interpretGroundedInteraction(interaction("answered"), [
      staffSource,
    ]);
    expect(result.status).toBe("answered");
    expect(result.sources[0]?.sourceType).toBe("manager_faq");
  });

  it("falls back when an answer has no mapped citation", () => {
    const result = interpretGroundedInteraction(
      interaction("answered", false),
      [staffSource],
    );
    expect(result.status).toBe("not_found");
    expect(result.contactRecommended).toBe(true);
  });

  it("turns conflicting information into a contact fallback", () => {
    const result = interpretGroundedInteraction(
      interaction("conflicting_information"),
      [staffSource],
    );
    expect(result.status).toBe("conflicting_information");
    expect(result.contactRecommended).toBe(true);
  });

  it("uses a mocked Gemini interaction for a contextual follow-up", async () => {
    const client = {
      create: vi.fn().mockResolvedValue(interaction("answered")),
    };
    const result = await askGroundedQuestion(
      client,
      {
        message: "Who should I contact?",
        history: [
          {
            role: "user",
            content: "I filled out an assistance application.",
          },
          {
            role: "assistant",
            content: "A staff member can help with application follow-up.",
          },
        ],
      },
      {
        model: "gemini-3.1-flash-lite",
        fileSearchStore: "fileSearchStores/test",
        manifest: [staffSource],
      },
    );
    expect(result.status).toBe("answered");
    expect(client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        store: false,
        input: expect.arrayContaining([
          expect.objectContaining({ type: "model_output" }),
          expect.objectContaining({ type: "user_input" }),
        ]),
      }),
    );
  });
});
