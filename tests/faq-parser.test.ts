import path from "node:path";

import { describe, expect, it } from "vitest";

import { readManagerFaqDocument } from "../scripts/parse-manager-faq";

const sourcePath = path.resolve(
  process.cwd(),
  "knowledge/source/chatbot-questions.docx",
);

describe("staff FAQ parsing", () => {
  it("withholds incomplete FAQ entries from the approved corpus", async () => {
    const entries = await readManagerFaqDocument(sourcePath);
    const pendingIds = entries
      .filter((entry) => entry.status !== "approved")
      .map((entry) => entry.id);
    expect(pendingIds).toEqual([
      "furniture-delivery-fees",
      "return-policy",
      "electronics-testing-outlets",
      "colored-clothing-barbs",
      "price-negotiation",
      "clothing-exchanges",
    ]);
    expect(
      entries
        .filter((entry) => entry.status === "approved")
        .some((entry) => entry.id === "return-policy"),
    ).toBe(false);
  });

  it("represents known approved questions and contacts correctly", async () => {
    const entries = await readManagerFaqDocument(sourcePath);
    const followUp = entries.find(
      (entry) => entry.id === "assistance-application-follow-up",
    );
    const shopper = entries.find((entry) => entry.id === "expired-shopper-id");
    expect(followUp?.contacts).toContain("clientassist@theplacega.org");
    expect(followUp?.answer).toContain("770-887-1098");
    expect(shopper?.relatedUrls).toContain(
      "https://www.theplacega.org/food-pantry-request",
    );
  });
});

