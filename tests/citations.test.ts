import { describe, expect, it } from "vitest";

import { resolveFileCitations } from "@/lib/gemini/citations";
import type { SourceManifestEntry } from "@/lib/knowledge/types";

const websiteSource: SourceManifestEntry = {
  id: "food-donations",
  fileName: "website__food-donations.md",
  documentPath: "knowledge/generated/prepared/website__food-donations.md",
  title: "Food Donations",
  url: "https://www.theplacega.org/food-donations",
  sourceType: "official_website",
  priority: 50,
};

describe("citation resolution", () => {
  it("resolves a valid website citation through custom metadata", () => {
    const sources = resolveFileCitations(
      [
        {
          type: "file_citation",
          file_name: "display-name.md",
          custom_metadata: { source_id: "food-donations" },
        },
      ],
      [websiteSource],
    );
    expect(sources).toEqual([
      {
        id: "food-donations",
        title: "Food Donations",
        url: "https://www.theplacega.org/food-donations",
        sourceType: "official_website",
      },
    ]);
  });

  it("drops unmapped citations", () => {
    expect(
      resolveFileCitations(
        [{ type: "file_citation", file_name: "unknown.md" }],
        [websiteSource],
      ),
    ).toEqual([]);
  });

  it("rejects unsupported website source URLs", () => {
    expect(
      resolveFileCitations(
        [{ type: "file_citation", file_name: "bad.md" }],
        [{ ...websiteSource, fileName: "bad.md", url: "https://example.com" }],
      ),
    ).toEqual([]);
  });
});

