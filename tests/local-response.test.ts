import { describe, expect, it } from "vitest";

import { getLocalConversationalResponse } from "@/lib/chat/local-response";
import type { SourceManifestEntry } from "@/lib/knowledge/types";

const officialDocuments: SourceManifestEntry[] = [
  {
    id: "volunteer-handbook-2026",
    fileName: "official_document__volunteer-handbook-2026.pdf",
    documentPath:
      "knowledge/generated/prepared/official_document__volunteer-handbook-2026.pdf",
    title: "The Place Volunteer Handbook - Version 1.1 (June 24, 2026)",
    url: "https://www.theplacega.org/volunteer-handbook",
    sourceType: "official_document",
    priority: 75,
  },
  {
    id: "heart-of-service-july-2026",
    fileName: "official_document__heart-of-service-july-2026.pdf",
    documentPath:
      "knowledge/generated/prepared/official_document__heart-of-service-july-2026.pdf",
    title: "Heart of Service - July 2026 Birthday Cake Kits",
    url: "https://www.theplacega.org/heart-of-service",
    sourceType: "official_document",
    priority: 75,
  },
];

describe("local conversational responses", () => {
  it.each(["hello", "Hi!", "good morning", "HEY THERE?"])(
    "recognizes a standalone greeting: %j",
    (message) => {
      const response = getLocalConversationalResponse(message);

      expect(response?.status).toBe("answered");
      expect(response?.contactRecommended).toBe(false);
      expect(response?.sources[0]?.url).toBe("https://www.theplacega.org/");
    },
  );

  it.each([
    "what questions can You answer",
    "What can you help me with?",
    "which topics can i ask?",
  ])("explains supported question areas: %j", (message) => {
    expect(getLocalConversationalResponse(message)?.answer).toContain(
      "thrift-store donations",
    );
  });

  it("does not intercept an organization-information question", () => {
    expect(
      getLocalConversationalResponse(
        "Hello, who handles thrift store donations?",
      ),
    ).toBeUndefined();
  });

  it.each([
    "handbook",
    "the handbook",
    "do u have access to the handbook?",
    "do u have access to the volunteer handbook?",
    "Do you have access to the volunteer handbook?",
    "Can you read The Place volunteer handbook?",
    "Are you able to reference the volunteer handbook?",
    "Can you help me with the handbook?",
    "I need help with the handbook.",
    "Do you know about the handbook?",
  ])("confirms access only from the registered official document: %j", (message) => {
    const response = getLocalConversationalResponse(message, officialDocuments);

    expect(response).toEqual(
      expect.objectContaining({
        status: "answered",
        contactRecommended: false,
        sources: [
          expect.objectContaining({
            id: "volunteer-handbook-2026",
            url: "https://www.theplacega.org/volunteer-handbook",
            sourceType: "official_document",
          }),
        ],
      }),
    );
    expect(response?.answer).toMatch(/^Yes/);
    expect(response?.answer).toContain("Volunteer Handbook");
    expect(response?.answer).toContain("What would you like to know?");
  });

  it("sends factual handbook questions through grounded File Search", () => {
    expect(
      getLocalConversationalResponse(
        "What does the handbook say about volunteer age requirements?",
        officialDocuments,
      ),
    ).toBeUndefined();
  });

  it("does not claim access to an unregistered or ambiguous document", () => {
    expect(
      getLocalConversationalResponse(
        "Do you have access to my volunteer application?",
        officialDocuments,
      ),
    ).toBeUndefined();
    expect(
      getLocalConversationalResponse(
        "Do you have access to that document?",
        officialDocuments,
      ),
    ).toBeUndefined();
  });
});
